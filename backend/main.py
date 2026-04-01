from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="ShopRight API")

# CORS — allow frontend origins
origins = [
    "http://localhost:5173",
    os.getenv("FRONTEND_URL", ""),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://shopright.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


from routers.auth import router as auth_router

app.include_router(auth_router)


@app.get("/health")
def health_check():
    return {"success": True, "data": "ShopRight API is running", "error": None}


from fastapi import Header
from db import SUPABASE_URL, SUPABASE_ANON_KEY
import httpx


@app.get("/debug/auth")
def debug_auth(authorization: str = Header(default="")):
    """Temporary debug endpoint — remove after Phase 1."""
    token = authorization.replace("Bearer ", "") if authorization else ""
    if not token:
        return {"error": "No token provided", "supabase_url_set": bool(SUPABASE_URL), "anon_key_set": bool(SUPABASE_ANON_KEY)}
    try:
        r = httpx.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_ANON_KEY},
        )
        return {
            "supabase_status": r.status_code,
            "supabase_response": r.json() if r.status_code == 200 else r.text[:300],
            "token_preview": f"{token[:20]}...{token[-10:]}",
        }
    except Exception as e:
        return {"error": str(e)}
