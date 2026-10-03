import os
import httpx
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# postgrest, gotrue, storage3, and supafunc each construct an httpx.Client
# with http2=True and no way to turn it off (supabase 2.7 / postgrest 0.16).
# That client is one process-wide object, and FastAPI runs sync endpoints on
# a thread pool, so autosave (PUT /visits/{id}) uses it from many threads.
#
# httpcore does not drop an HTTP/2 connection that has hit a connection reset.
# The socket stays in the pool: idle, not closed, and not available. The next
# request opens another connection beside it. A burst of resets — the failure
# logged against this client on 2026-08-21 — therefore stacks dead HTTP/2
# connections. Their h2 and TLS buffers are still referenced, so malloc_trim
# cannot give the memory back, and RSS climbs until the process is killed.
# HTTP/1 closes the failed connection instead of keeping it.
#
# Installed before create_client so every sync client the SDK builds is HTTP/1
# with a small pool. Keyword-only http2=True from the libraries is overwritten.
_HTTPX_CLIENT_INIT = httpx.Client.__init__


def _http1_client_init(self, *args, **kwargs):
    kwargs["http2"] = False
    kwargs.setdefault(
        "limits",
        httpx.Limits(
            max_connections=10,
            max_keepalive_connections=2,
            keepalive_expiry=5.0,
        ),
    )
    _HTTPX_CLIENT_INIT(self, *args, **kwargs)


httpx.Client.__init__ = _http1_client_init

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Service role client — for all backend data operations (bypasses RLS)
# Anon client removed: was never used (all auth done via direct httpx JWT verify)
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
