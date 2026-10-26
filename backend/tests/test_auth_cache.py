"""Token verification is cached, and failures are not.

get_user_id used to call Supabase on every request. Autosave made that the
hot path. Successful lookups are reused for a few minutes, never past the
token's own exp, and the map is capped. A 401 or a transport error is not stored.
"""
import base64
import json
import time

import pytest
from fastapi import HTTPException

import routers.auth as auth


def _jwt(exp=None, sub="user-1"):
    header = base64.urlsafe_b64encode(b'{"alg":"none"}').rstrip(b"=").decode()
    body = {"sub": sub}
    if exp is not None:
        body["exp"] = exp
    payload = base64.urlsafe_b64encode(json.dumps(body).encode()).rstrip(b"=").decode()
    return f"{header}.{payload}.sig"


class Resp:
    def __init__(self, status, payload):
        self.status_code = status
        self._payload = payload
        self.text = payload if isinstance(payload, str) else json.dumps(payload)

    def json(self):
        if isinstance(self._payload, str):
            raise ValueError("not json")
        return self._payload


def _stub(monkeypatch, responder):
    calls = []

    def fake_get(url, headers=None, timeout=None):
        calls.append({"url": url, "headers": headers, "timeout": timeout})
        return responder(calls)

    monkeypatch.setattr(auth.outbound, "get", fake_get)
    auth.clear_auth_cache()
    return calls


def test_successful_verification_is_reused(monkeypatch):
    calls = _stub(monkeypatch, lambda _calls: Resp(200, {"id": "user-1"}))
    token = _jwt(exp=time.time() + 3600)
    assert auth.get_user_id(f"Bearer {token}") == "user-1"
    assert auth.get_user_id(f"Bearer {token}") == "user-1"
    assert len(calls) == 1
    assert calls[0]["timeout"] == 5.0


def test_failures_are_not_cached(monkeypatch):
    calls = _stub(monkeypatch, lambda _calls: Resp(401, "nope"))
    token = _jwt(exp=time.time() + 3600)
    with pytest.raises(HTTPException) as first:
        auth.get_user_id(f"Bearer {token}")
    with pytest.raises(HTTPException):
        auth.get_user_id(f"Bearer {token}")
    assert first.value.status_code == 401
    assert len(calls) == 2
    assert len(auth._auth_cache) == 0


def test_transport_errors_are_not_cached(monkeypatch):
    def boom(url, headers=None, timeout=None):
        boom.n += 1
        raise ConnectionError("reset")

    boom.n = 0
    monkeypatch.setattr(auth.outbound, "get", boom)
    auth.clear_auth_cache()
    with pytest.raises(HTTPException):
        auth.get_user_id("Bearer abc")
    with pytest.raises(HTTPException):
        auth.get_user_id("Bearer abc")
    assert boom.n == 2


def test_expired_token_is_not_cached_even_if_supabase_accepts_it(monkeypatch):
    calls = _stub(monkeypatch, lambda _calls: Resp(200, {"id": "user-1"}))
    token = _jwt(exp=time.time() - 30)
    assert auth.get_user_id(f"Bearer {token}") == "user-1"
    assert auth.get_user_id(f"Bearer {token}") == "user-1"
    assert len(calls) == 2
    assert len(auth._auth_cache) == 0


def test_cache_expires_when_the_token_expires(monkeypatch):
    clock = {"wall": 1_700_000_000.0, "mono": 1000.0}
    monkeypatch.setattr(auth, "_wall_time", lambda: clock["wall"])
    monkeypatch.setattr(auth, "_mono", lambda: clock["mono"])
    calls = _stub(monkeypatch, lambda _calls: Resp(200, {"id": "user-1"}))
    token = _jwt(exp=clock["wall"] + 30)
    assert auth.get_user_id(f"Bearer {token}") == "user-1"
    clock["wall"] += 29
    clock["mono"] += 29
    assert auth.get_user_id(f"Bearer {token}") == "user-1"
    assert len(calls) == 1
    clock["wall"] += 2
    clock["mono"] += 2
    assert auth.get_user_id(f"Bearer {token}") == "user-1"
    assert len(calls) == 2


def test_token_without_exp_is_cached_until_the_ttl(monkeypatch):
    clock = {"wall": 100.0, "mono": 50.0}
    monkeypatch.setattr(auth, "_wall_time", lambda: clock["wall"])
    monkeypatch.setattr(auth, "_mono", lambda: clock["mono"])
    calls = _stub(monkeypatch, lambda _calls: Resp(200, {"id": "user-9"}))
    assert auth.get_user_id("Bearer not-a-jwt") == "user-9"
    clock["mono"] += auth._AUTH_CACHE_TTL - 1
    assert auth.get_user_id("Bearer not-a-jwt") == "user-9"
    assert len(calls) == 1
    clock["mono"] += 2
    assert auth.get_user_id("Bearer not-a-jwt") == "user-9"
    assert len(calls) == 2


def test_cache_is_bounded(monkeypatch):
    _stub(monkeypatch, lambda _calls: Resp(200, {"id": "user-1"}))
    exp = time.time() + 3600
    for i in range(auth._AUTH_CACHE_MAX + 40):
        auth.get_user_id("Bearer " + _jwt(exp=exp, sub=f"u{i}"))
    assert len(auth._auth_cache) == auth._AUTH_CACHE_MAX
