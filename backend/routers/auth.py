import base64
import json
import threading
import time
from collections import OrderedDict

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from typing import Optional
from db import supabase_admin, SUPABASE_URL, SUPABASE_ANON_KEY, claude, outbound

router = APIRouter(prefix="/auth", tags=["auth"])

# Successful verifications only. A shopping session reuses one access token for
# every autosave; asking Supabase each time is what built a new SSL context per
# PUT. A few minutes is enough to collapse that to a handful of checks per hour.
# Failures are not stored. The entry is dropped at the token's own exp if that
# is sooner, and the map is capped so a flood of distinct tokens cannot grow it.
_AUTH_CACHE_TTL = 180.0
_AUTH_CACHE_MAX = 256
_auth_cache = OrderedDict()
_auth_lock = threading.Lock()


def _wall_time():
    return time.time()


def _mono():
    return time.monotonic()


def _token_exp(token):
    """JWT exp claim, or None when the token isn't a JWT. Signature is not checked.

    Identity still comes from Supabase. exp only limits how long a successful
    verification may be reused.
    """
    parts = token.split(".")
    if len(parts) < 2:
        return None
    try:
        payload = parts[1]
        pad = "=" * (-len(payload) % 4)
        data = json.loads(base64.urlsafe_b64decode(payload + pad))
    except Exception:
        return None
    exp = data.get("exp") if isinstance(data, dict) else None
    if isinstance(exp, (int, float)):
        return float(exp)
    return None


def clear_auth_cache():
    with _auth_lock:
        _auth_cache.clear()


def get_user_id(authorization: str = Header(...)) -> str:
    """Extract and verify user from Supabase JWT via direct API call."""
    token = authorization.replace("Bearer ", "")
    now = _mono()
    with _auth_lock:
        hit = _auth_cache.get(token)
        if hit is not None:
            user_id, deadline = hit
            if deadline > now:
                _auth_cache.move_to_end(token)
                return user_id
            _auth_cache.pop(token, None)
    try:
        r = outbound.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_ANON_KEY,
            },
            timeout=5.0,
        )
        if r.status_code != 200:
            raise HTTPException(
                status_code=401,
                detail=f"Supabase auth returned {r.status_code}: {r.text[:200]}"
            )
        user_id = r.json()["id"]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Auth error: {type(e).__name__}: {str(e)}")

    ttl = _AUTH_CACHE_TTL
    exp = _token_exp(token)
    if exp is not None:
        remaining = exp - _wall_time()
        if remaining <= 0:
            return user_id
        ttl = min(ttl, remaining)
    with _auth_lock:
        _auth_cache[token] = (user_id, _mono() + ttl)
        _auth_cache.move_to_end(token)
        while len(_auth_cache) > _AUTH_CACHE_MAX:
            _auth_cache.popitem(last=False)
    return user_id


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    report_email: Optional[str] = None
    phone: Optional[str] = None
    home_address: Optional[str] = None
    mileage_rate: Optional[float] = None
    invoice_number_start: Optional[int] = None
    anthropic_api_key: Optional[str] = None
    ai_review_enabled: Optional[bool] = None
    billing_address: Optional[str] = None
    default_start_address: Optional[str] = None
    default_end_address: Optional[str] = None
    invoice_start_day: Optional[int] = None
    invoice_end_day: Optional[int] = None


@router.get("/profile")
def get_profile(authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    result = supabase_admin.table("profiles").select("*").eq("id", user_id).single().execute()
    return {"success": True, "data": result.data, "error": None}


@router.put("/profile")
def update_profile(body: ProfileUpdate, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        return {"success": True, "data": None, "error": "No fields to update"}
    result = supabase_admin.table("profiles").update(updates).eq("id", user_id).execute()
    return {"success": True, "data": result.data[0] if result.data else None, "error": None}


class TestKeyRequest(BaseModel):
    api_key: str


@router.post("/test-api-key")
def test_api_key(body: TestKeyRequest, authorization: str = Header(...)):
    """Test an Anthropic API key by making a minimal API call."""
    get_user_id(authorization)  # verify auth
    try:
        claude(api_key=body.api_key, messages=[{"role": "user", "content": "Say OK"}], max_tokens=10)
        return {"success": True, "data": "API key is valid", "error": None}
    except ValueError as e:
        if "invalid_key" in str(e):
            return {"success": False, "data": None, "error": "Invalid API key"}
        return {"success": False, "data": None, "error": f"Connection test failed: {str(e)}"}
    except Exception as e:
        return {"success": False, "data": None, "error": f"Connection test failed: {str(e)}"}
