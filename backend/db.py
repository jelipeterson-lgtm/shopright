import os
import threading
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


# One process-wide client for every outbound call that used to go through
# httpx.get/post/head. Those helpers construct a new Client per call, and each
# Client loads the CA bundle into a fresh SSL context — about 0.7 MB that is
# only released by a full garbage collection. get_user_id() did this on every
# authenticated request. PUT /visits autosave during a shopping session therefore
# climbed ~0.7 MB per save (Oct 15 2026: ~90 MB to the 512 MB limit, malloc_trim
# freed <1 MB). A single client keeps one SSL context and a small pool.
_outbound_lock = threading.Lock()
_outbound_client = None


def _new_outbound_client():
    return httpx.Client(
        timeout=httpx.Timeout(30.0, connect=10.0),
        limits=httpx.Limits(
            max_connections=20,
            max_keepalive_connections=4,
            keepalive_expiry=15.0,
        ),
        follow_redirects=False,
        http2=False,
    )


def outbound_client():
    """Return the shared client, creating it on first use and after close()."""
    global _outbound_client
    with _outbound_lock:
        if _outbound_client is None or _outbound_client.is_closed:
            _outbound_client = _new_outbound_client()
        return _outbound_client


def close_outbound_client():
    """Close the shared client. The next outbound call opens a new one."""
    global _outbound_client
    with _outbound_lock:
        if _outbound_client is not None and not _outbound_client.is_closed:
            _outbound_client.close()
        _outbound_client = None


class _Outbound:
    def get(self, *args, **kwargs):
        return outbound_client().get(*args, **kwargs)

    def post(self, *args, **kwargs):
        return outbound_client().post(*args, **kwargs)

    def head(self, *args, **kwargs):
        return outbound_client().head(*args, **kwargs)

    def close(self):
        close_outbound_client()


outbound = _Outbound()


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
    r = outbound.post(
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
