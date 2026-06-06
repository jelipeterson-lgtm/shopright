import os
import httpx
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Anon client — for auth operations (respects RLS)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# Service role client — for backend data operations (bypasses RLS)
supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def claude(api_key: str, messages: list, max_tokens: int = 1024, system: str = None) -> str:
    """
    Call Anthropic Messages API directly via httpx — no anthropic SDK required.
    Raises ValueError("invalid_key") on 401. Raises httpx.HTTPStatusError on other failures.
    Returns the assistant's text content.
    """
    payload = {
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": max_tokens,
        "messages": messages,
    }
    if system:
        payload["system"] = system
    r = httpx.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json=payload,
        timeout=30,
    )
    if r.status_code == 401:
        raise ValueError("invalid_key")
    r.raise_for_status()
    return r.json()["content"][0]["text"]
