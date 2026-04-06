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
def help_chat(body: HelpChatRequest, authorization: str = Header(...)):
    """AI help chatbot using user's API key."""
    from routers.auth import get_user_id
    from db import supabase_admin
    import anthropic

    system_prompt = """You are a friendly ShopRight help assistant. ShopRight is a mobile web app for mystery shoppers working with Smart Circle International. You know everything about this app and should guide users simply and clearly. Users are NOT technical — explain everything in plain language.

APP OVERVIEW:
ShopRight helps mystery shoppers record store visits, fill out assessment forms, and generate weekly reports and monthly invoices that get emailed to Smart Circle.

COMPLETE WORKFLOW:
1. Home page: tap "Start Session" to begin your shopping day
2. Session page: tap "New Store" to add a store you're visiting
3. GPS finds nearby stores, or search by store number/name
4. Select the store, confirm the program (vendor), tap Confirm
5. Fill out the assessment form for that vendor visit
6. Tap "Review & Submit" — AI reviews your notes (if enabled)
7. Address any AI flags or tap "Submit Anyway"
8. Back on Session page: "Add Another Vendor" at same store or "Close Store"
9. "New Store" for next location, "End Session" when done
10. Weekly: go to Weekly Shop File to generate and email your report
11. Monthly: go to Monthly Invoice, enter mileage, send invoice

ASSESSMENT FORM:
- Reps Present: Pass or Fail. If Fail, skip to Visit Recap.
- If Pass: enter rep names (optional), rep count (required)
- 12 evaluation fields: all default to Pass. Only tap Fail or N/A for exceptions.
- Fail opens a required comment field — describe the issue
- Soft Selling: only applies to Water programs (RS-DS WATER-Primo, RSW)
- Resource Guide: only applies to Costco stores
- Visit Recap: describe the overall visit at the bottom

NAVIGATION:
- Bottom bar: Home, Session, Reports, Profile, Settings
- Blue ? button: opens this help chat on any page

THE ONLY API KEY IN THIS APP:
The only API key users need is an Anthropic Claude API key for the optional AI Review feature. This is NOT required to use the app. If someone asks about "API" or "API key" they mean this:

HOW TO SET UP AI REVIEW (the Anthropic API key):
1. Open the app, tap Settings in the bottom nav
2. Find "AI Review" section, tap Enable
3. You need an Anthropic account — go to console.anthropic.com in your browser
4. Create an account (or sign in if you have one)
5. You need to add credits: go to Settings > Billing > Add credits. $5 minimum, lasts months.
6. Go to API Keys in the left sidebar
7. Click "Create Key", name it "ShopRight"
8. IMPORTANT: Copy the key immediately — you can't see it again!
9. Go back to ShopRight Settings, paste the key
10. Tap "Step 1: Test Connection" — should say "API key is valid!"
11. Tap "Step 2: Save API Key" — done!

REPORTS:
- Weekly Shop File: generates an Excel file with all your completed visits for the week. Emailed to Smart Circle.
- Monthly Invoice: enter mileage per shopping day, pricing auto-calculated ($50 first vendor per store per day, $15 each additional). Emailed to Smart Circle.

PRICING:
- $50 for the first vendor at each store location per day
- $15 for each additional vendor at the same store on the same day

TROUBLESHOOTING:
- "Load failed": usually means the server is starting up. Wait 30 seconds and try again.
- Can't find a store: use the search box, try the store number
- GPS not working: allow location access in your phone's settings
- Voice input not working: only works in Chrome browser
- AI review not working: check your API key in Settings

Keep answers SHORT, SIMPLE, and FRIENDLY. One step at a time. Never assume technical knowledge."""

    context = f"\n\nThe user is currently on: {body.page_context}" if body.page_context else ""

    user_id = get_user_id(authorization)
    profile = supabase_admin.table("profiles").select("anthropic_api_key, ai_review_enabled").eq("id", user_id).single().execute()
    api_key = profile.data.get("anthropic_api_key") if profile.data else None

    if not api_key:
        # Provide helpful static responses without AI
        msg = body.message.lower()
        if "api" in msg or "key" in msg or "ai" in msg or "review" in msg or "anthropic" in msg:
            return {"success": True, "data": "The only API key you need is for the AI Review feature (optional). Here's how to set it up:\n\n1. Go to Settings (bottom nav)\n2. Tap Enable under AI Review\n3. Go to console.anthropic.com in your browser\n4. Create an account, add $5 credits\n5. Go to API Keys > Create Key > name it \"ShopRight\"\n6. Copy the key, paste it in Settings\n7. Test Connection, then Save\n\nAI Review is optional — the app works fine without it!", "error": None}
        if "start" in msg or "session" in msg or "begin" in msg:
            return {"success": True, "data": "To start shopping:\n\n1. Tap 'Start Session' on the Home page\n2. Tap 'New Store' to add your first store\n3. Allow GPS or search by store number\n4. Select the store and program\n5. Fill out the assessment form\n6. Submit, then add more vendors or close the store", "error": None}
        if "report" in msg or "shop file" in msg or "weekly" in msg:
            return {"success": True, "data": "To send your weekly report:\n\n1. Tap 'Reports' in the bottom nav\n2. Or tap 'Weekly Shop File' on the Home page\n3. Check the visits listed\n4. Enter the recipient email\n5. Tap 'Send Shop File'", "error": None}
        if "invoice" in msg or "monthly" in msg or "mileage" in msg:
            return {"success": True, "data": "To send your monthly invoice:\n\n1. Tap 'Monthly Invoice' on the Home page\n2. Enter your mileage for each shopping day\n3. Review the pricing ($50 first vendor/store/day, $15 additional)\n4. Enter the recipient email\n5. Tap 'Generate & Send Invoice'", "error": None}
        return {"success": True, "data": "I can help with:\n\n- Starting a session and adding stores\n- Filling out assessment forms\n- Setting up AI Review (API key)\n- Sending weekly reports\n- Sending monthly invoices\n- GPS and store search issues\n\nWhat would you like help with?", "error": None}

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=400,
            system=system_prompt + context,
            messages=[{"role": "user", "content": body.message}],
        )
        return {"success": True, "data": response.content[0].text, "error": None}
    except Exception as e:
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
