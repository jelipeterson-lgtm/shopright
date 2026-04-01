from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from typing import Optional
from db import supabase_admin, SUPABASE_URL, SUPABASE_ANON_KEY
import anthropic
import httpx

router = APIRouter(prefix="/auth", tags=["auth"])


def get_user_id(authorization: str = Header(...)) -> str:
    """Extract and verify user from Supabase JWT via direct API call."""
    token = authorization.replace("Bearer ", "")
    try:
        r = httpx.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_ANON_KEY,
            },
        )
        if r.status_code != 200:
            raise ValueError(f"Auth failed: {r.status_code}")
        return r.json()["id"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    report_email: Optional[str] = None
    phone: Optional[str] = None
    home_address: Optional[str] = None
    mileage_rate: Optional[float] = None
    invoice_number_start: Optional[int] = None
    anthropic_api_key: Optional[str] = None
    ai_review_enabled: Optional[bool] = None


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
        client = anthropic.Anthropic(api_key=body.api_key)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=10,
            messages=[{"role": "user", "content": "Say OK"}],
        )
        return {"success": True, "data": "API key is valid", "error": None}
    except anthropic.AuthenticationError:
        return {"success": False, "data": None, "error": "Invalid API key"}
    except Exception as e:
        return {"success": False, "data": None, "error": f"Connection test failed: {str(e)}"}
