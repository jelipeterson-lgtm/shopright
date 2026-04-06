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
from routers.stores import router as stores_router
from routers.visits import router as visits_router
from routers.review import router as review_router
from routers.reports import router as reports_router
from routers.payments import router as payments_router

app.include_router(auth_router)
app.include_router(stores_router)
app.include_router(visits_router)
app.include_router(review_router)
app.include_router(reports_router)
app.include_router(payments_router)


@app.get("/health")
def health_check():
    return {"success": True, "data": "ShopRight API is running", "error": None}


from pydantic import BaseModel
import resend

resend.api_key = os.getenv("RESEND_API_KEY")


class ContactForm(BaseModel):
    name: str
    email: str
    message: str


class HelpChatRequest(BaseModel):
    message: str
    page_context: str = ""


@app.post("/help/chat")
def help_chat(body: HelpChatRequest, authorization: str = Header(default="")):
    """AI help chatbot using user's API key or a built-in fallback."""
    from routers.auth import get_user_id
    from db import supabase_admin
    import anthropic

    system_prompt = """You are a friendly ShopRight help assistant. ShopRight is a mobile web app for mystery shoppers at Smart Circle International.

Key features:
- Start a session > Add stores via GPS or search > Add vendor visits > Fill assessment form > AI review > Submit
- Assessment form: Reps Present (Pass/Fail gate), 12 evaluation fields (Pass/Fail/N/A), Visit Recap
- Weekly Shop File: generates Excel report emailed to Smart Circle
- Monthly Invoice: enter mileage, auto-calculates pricing ($50 first vendor per stop, $15 additional)
- AI Review: optional, uses user's own Anthropic API key. Set up in Settings.

Setting up AI Review:
1. Go to Settings
2. Under AI Review tap Enable
3. Go to console.anthropic.com, create an account
4. Add $5 credits (lasts months)
5. Go to API Keys > Create Key > name it ShopRight
6. Copy the key, paste it in Settings
7. Test the connection, then Save

Keep answers short, simple, and friendly. Users are not technical. Guide them step by step."""

    context = f"\n\nThe user is currently on: {body.page_context}" if body.page_context else ""

    # Try user's key first
    api_key = None
    try:
        user_id = get_user_id(authorization)
        profile = supabase_admin.table("profiles").select("anthropic_api_key").eq("id", user_id).single().execute()
        api_key = profile.data.get("anthropic_api_key")
    except Exception:
        pass

    if not api_key:
        return {"success": True, "data": "I'm here to help! For AI-powered answers, set up your API key in Settings. In the meantime, here are common topics:\n\n- To start shopping: tap Start Session on the Home page\n- To set up AI review: go to Settings > AI Review > Enable\n- To send reports: go to Weekly Shop File or Monthly Invoice from Home", "error": None}

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            system=system_prompt + context,
            messages=[{"role": "user", "content": body.message}],
        )
        return {"success": True, "data": response.content[0].text, "error": None}
    except Exception:
        return {"success": True, "data": "Sorry, I couldn't process that right now. Try again in a moment.", "error": None}


@app.post("/contact")
def send_contact(body: ContactForm):
    try:
        resend.Emails.send({
            "from": "Contact Form <onboarding@resend.dev>",
            "to": ["j.eli.peterson@gmail.com"],
            "subject": f"Contact from {body.name} — Eli Peterson Consulting",
            "html": f"<p><strong>From:</strong> {body.name} ({body.email})</p><p>{body.message}</p>",
            "reply_to": body.email,
        })
        return {"success": True}
    except Exception:
        return {"success": False}
