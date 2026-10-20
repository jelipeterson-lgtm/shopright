"""PUT /visits must not retain a client per request.

On the old code, get_user_id called httpx.get(), and that helper builds a new
httpx.Client (and a new SSL context that loads the CA bundle) every time.
With garbage collection suspended — the same situation as a shopping session,
where those cycles sit in generation 2 and malloc_trim frees nothing — 3000
PUTs grew RSS from 61.1 MB to 2295.3 MB (0.745 MB/request). Render on
Oct 15 2026 climbed about 0.7 MB per request from ~90 MB to the 512 MB limit.

This drives the real FastAPI route. Auth and PostgREST both speak TLS to a
local stub, so the shared client is a real network client. Collection stays
off during the run, which is what makes the old per-request client visible.
A regression that constructs a client per save fails within the first few
hundred requests instead of exhausting the runner.
"""
import base64
import ctypes
import gc
import json
import os
import socket
import ssl
import subprocess
import tempfile
import threading
import time

import pytest

# With collection suspended, ordinary request objects (the visit body, the
# JSON response) stay alive: about 0.05 MB each, ~150 MB across 3000 saves.
# The old per-request httpx client was ~0.75 MB each and blew past this
# bound before 500 requests. 250 MB still fails that regression and leaves
# room for allocator noise on CI.
_MAX_GROWTH_MB = 250
_REQUESTS = 3000


def _rss_mb():
    with open("/proc/self/status") as handle:
        for line in handle:
            if line.startswith("VmRSS:"):
                return int(line.split()[1]) / 1024
    raise RuntimeError("VmRSS missing")


def _trim():
    libc = ctypes.CDLL("libc.so.6")
    libc.malloc_trim(0)


def _jwt(sub):
    header = base64.urlsafe_b64encode(b'{"alg":"none"}').rstrip(b"=").decode()
    payload = base64.urlsafe_b64encode(json.dumps({
        "sub": sub,
        "exp": int(time.time()) + 3600,
    }).encode()).rstrip(b"=").decode()
    return f"{header}.{payload}.sig"


def _cert():
    directory = tempfile.mkdtemp()
    cert = os.path.join(directory, "cert.pem")
    key = os.path.join(directory, "key.pem")
    subprocess.check_call(
        [
            "openssl", "req", "-x509", "-newkey", "rsa:2048",
            "-keyout", key, "-out", cert, "-days", "1", "-nodes",
            "-subj", "/CN=localhost",
            "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    import certifi
    bundle = os.path.join(directory, "ca.pem")
    with open(bundle, "wb") as out:
        with open(certifi.where(), "rb") as src:
            out.write(src.read())
        out.write(b"\n")
        with open(cert, "rb") as src:
            out.write(src.read())
    return cert, key, bundle


def _read_request(conn):
    data = b""
    while b"\r\n\r\n" not in data:
        chunk = conn.recv(65535)
        if not chunk:
            return None
        data += chunk
    head, rest = data.split(b"\r\n\r\n", 1)
    headers = {}
    lines = head.decode("latin1").split("\r\n")
    for line in lines[1:]:
        if ":" in line:
            name, value = line.split(":", 1)
            headers[name.strip().lower()] = value.strip()
    length = int(headers.get("content-length", "0") or 0)
    body = rest
    while len(body) < length:
        chunk = conn.recv(65535)
        if not chunk:
            break
        body += chunk
    return lines[0]


def _serve(conn):
    try:
        while True:
            line = _read_request(conn)
            if not line:
                return
            if "/auth/v1/user" in line:
                body = b'{"id":"11111111-1111-1111-1111-111111111111"}'
            else:
                body = (
                    b'[{"id":"visit-1","user_id":"11111111-1111-1111-1111-111111111111",'
                    b'"status":"Draft","visit_recap":"ok"}]'
                )
            conn.sendall(
                b"HTTP/1.1 200 OK\r\n"
                b"content-type: application/json\r\n"
                b"content-length: " + str(len(body)).encode() + b"\r\n"
                b"connection: keep-alive\r\n\r\n" + body
            )
    except Exception:
        pass
    finally:
        try:
            conn.close()
        except Exception:
            pass


def _handle(raw, cert, key):
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(cert, key)
    try:
        conn = ctx.wrap_socket(raw, server_side=True)
    except Exception:
        raw.close()
        return
    _serve(conn)


@pytest.fixture(scope="module")
def tls_stub():
    cert, key, bundle = _cert()
    previous = os.environ.get("SSL_CERT_FILE")
    os.environ["SSL_CERT_FILE"] = bundle
    srv = socket.socket()
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("127.0.0.1", 0))
    srv.listen(256)
    port = srv.getsockname()[1]

    def accept_loop():
        while True:
            try:
                client, _addr = srv.accept()
            except OSError:
                return
            threading.Thread(target=_handle, args=(client, cert, key), daemon=True).start()

    threading.Thread(target=accept_loop, daemon=True).start()
    yield f"https://127.0.0.1:{port}"
    srv.close()
    if previous is None:
        os.environ.pop("SSL_CERT_FILE", None)
    else:
        os.environ["SSL_CERT_FILE"] = previous


def test_put_visits_memory_stays_flat_across_thousands_of_saves(tls_stub):
    from fastapi.testclient import TestClient
    from postgrest import SyncPostgrestClient

    import db
    import main
    import routers.auth as auth

    # The shared client may already have been built against the default CA
    # bundle at import. Rebuild it so it trusts this stub's certificate.
    db.close_outbound_client()
    previous_url = auth.SUPABASE_URL
    previous_key = auth.SUPABASE_ANON_KEY
    auth.SUPABASE_URL = tls_stub
    auth.SUPABASE_ANON_KEY = "anon-key"
    auth.clear_auth_cache()

    previous = db.supabase_admin.postgrest
    db.supabase_admin._postgrest = SyncPostgrestClient(
        f"{tls_stub}/rest/v1",
        headers=dict(previous.session.headers),
        timeout=10,
    )

    client = TestClient(main.app)
    payload = {"visit_recap": "Reps were at the kiosk and engaging members."}
    # Warm the pools, then drop everything collection can drop, so the
    # measurement starts from a steady process.
    for _ in range(15):
        warmed = client.put(
            "/visits/visit-1",
            json=payload,
            headers={"Authorization": "Bearer " + _jwt("warmup")},
        )
        assert warmed.status_code == 200, warmed.text
    gc.collect()
    _trim()
    start = _rss_mb()

    gc.disable()
    sent = 0
    try:
        for i in range(1, _REQUESTS + 1):
            # A new token every time, so the auth cache cannot skip the network.
            response = client.put(
                "/visits/visit-1",
                json=payload,
                headers={"Authorization": "Bearer " + _jwt(f"shopper-{i}")},
            )
            assert response.status_code == 200, response.text
            sent = i
            if i % 250 == 0:
                growth = _rss_mb() - start
                assert growth < _MAX_GROWTH_MB, (
                    f"RSS grew {growth:.1f} MB after {i} PUT /visits "
                    f"(start {start:.1f} MB). A per-request httpx client "
                    f"retains about 0.7 MB each."
                )
        end = _rss_mb()
    finally:
        gc.enable()
        gc.collect()
        _trim()
        after = _rss_mb()
        db.supabase_admin._postgrest = previous
        auth.SUPABASE_URL = previous_url
        auth.SUPABASE_ANON_KEY = previous_key
        auth.clear_auth_cache()
        db.close_outbound_client()

    growth = end - start
    print(
        f"PUT /visits memory: start_mb={start:.1f} end_mb={end:.1f} "
        f"growth_mb={growth:.1f} requests={sent} after_gc_trim_mb={after:.1f}"
    )
    assert sent == _REQUESTS
    assert growth < _MAX_GROWTH_MB


def test_server_modules_do_not_call_httpx_per_request():
    """httpx.get/post/head each build a Client. The server must not call them."""
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    offenders = []
    for dirpath, dirnames, files in os.walk(root):
        dirnames[:] = [name for name in dirnames if name != "tests" and name != "__pycache__"]
        for name in files:
            if not name.endswith(".py"):
                continue
            path = os.path.join(dirpath, name)
            text = open(path).read()
            for needle in ("httpx.get(", "httpx.post(", "httpx.head(", "httpx.request("):
                if needle in text:
                    offenders.append(f"{os.path.relpath(path, root)} contains {needle}")
    assert offenders == []
