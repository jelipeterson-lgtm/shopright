from fastapi import FastAPI, Header
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
from routers.route import router as route_router

app.include_router(auth_router)
app.include_router(stores_router)
app.include_router(visits_router)
app.include_router(review_router)
app.include_router(reports_router)
app.include_router(payments_router)
app.include_router(route_router)


import resource
import threading
import time
import httpx


def _rss_mb():
    """Current process RSS in MB.
    Linux: reads VmRSS from /proc/self/status (current, not peak).
    macOS fallback: ru_maxrss (bytes on macOS).
    """
    import platform
    if platform.system() == "Linux":
        try:
            with open("/proc/self/status") as f:
                for line in f:
                    if line.startswith("VmRSS:"):
                        return int(line.split()[1]) / 1024  # kB → MB
        except Exception:
            pass
        # fallback: ru_maxrss is kB on Linux
        return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024
    # macOS: ru_maxrss is bytes
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / (1024 * 1024)


def _peak_rss_mb():
    """Peak physical RSS since process start (Linux: VmHWM high-water-mark; macOS: ru_maxrss)."""
    import platform
    if platform.system() == "Linux":
        try:
            with open("/proc/self/status") as f:
                for line in f:
                    if line.startswith("VmHWM:"):  # High Water Mark = peak physical RAM
                        return int(line.split()[1]) / 1024
        except Exception:
            pass
        return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / (1024 * 1024)


print(f"[startup] RSS after import: {_rss_mb():.1f} MB  peak: {_peak_rss_mb():.1f} MB")


@app.get("/health")
def health_check():
    return {"success": True, "data": "ShopRight API is running", "error": None}


@app.get("/debug/memory")
def debug_memory():
    """Live memory stats.
    rss_mb        = VmRSS — process's own view of physical RAM
    peak_rss_mb   = VmHWM — high-water-mark since process start
    cgroup_limit_mb  = ACTUAL limit Render enforces (read from kernel cgroup, not hardcoded)
    cgroup_usage_mb  = ACTUAL usage Render sees (may exceed rss_mb — includes page cache etc.)
    headroom_mb   = cgroup_limit - cgroup_usage (true remaining headroom)
    vm_size_mb    = virtual address space (does NOT cause OOM — normal for Python to be large)
    """
    import platform
    rss = _rss_mb()
    info = {
        "rss_mb": round(rss, 1),
        "peak_rss_mb": round(_peak_rss_mb(), 1),
        "platform": platform.system(),
    }

    if platform.system() == "Linux":
        # Read /proc/self/status for virtual memory metrics
        try:
            with open("/proc/self/status") as f:
                for line in f:
                    if line.startswith("VmSize:"):
                        info["vm_size_mb"] = round(int(line.split()[1]) / 1024, 1)
                    elif line.startswith("VmPeak:"):
                        info["vm_peak_mb"] = round(int(line.split()[1]) / 1024, 1)
        except Exception:
            pass

        # Read ACTUAL cgroup memory limit — this is what Render enforces, not a hardcoded guess
        cgroup_limit = None
        cgroup_usage = None

        # cgroup v2 (newer kernels)
        try:
            with open("/sys/fs/cgroup/memory.max") as f:
                content = f.read().strip()
                if content != "max":
                    cgroup_limit = round(int(content) / (1024 * 1024), 1)
        except Exception:
            pass
        try:
            with open("/sys/fs/cgroup/memory.current") as f:
                cgroup_usage = round(int(f.read().strip()) / (1024 * 1024), 1)
        except Exception:
            pass

        # cgroup v1 fallback
        if cgroup_limit is None:
            try:
                with open("/sys/fs/cgroup/memory/memory.limit_in_bytes") as f:
                    val = int(f.read().strip())
                    if val < (2 ** 62):  # 9223372036854771712 = "unlimited"
                        cgroup_limit = round(val / (1024 * 1024), 1)
            except Exception:
                pass
        if cgroup_usage is None:
            try:
                with open("/sys/fs/cgroup/memory/memory.usage_in_bytes") as f:
                    cgroup_usage = round(int(f.read().strip()) / (1024 * 1024), 1)
            except Exception:
                pass

        info["cgroup_limit_mb"] = cgroup_limit if cgroup_limit else "unreadable"
        info["cgroup_usage_mb"] = cgroup_usage if cgroup_usage else "unreadable"
        if cgroup_limit and cgroup_usage:
            info["headroom_mb"] = round(cgroup_limit - cgroup_usage, 1)
        elif cgroup_limit:
            info["headroom_mb"] = round(cgroup_limit - rss, 1)
        else:
            info["headroom_mb"] = "unknown — cgroup limit unreadable"

    return info


# Keep-alive: prevent Render free tier from sleeping
_keep_alive_client = httpx.Client(timeout=10)

def keep_alive():
    """Ping self every 14 minutes to prevent Render free tier sleep.
    Also calls malloc_trim to release freed Python allocator blocks back to the OS,
    preventing gradual RSS accumulation over long-running process lifetimes.
    """
    import ctypes
    url = os.getenv("RENDER_EXTERNAL_URL", "https://shopright-api.onrender.com") + "/health"
    while True:
        time.sleep(840)  # 14 minutes
        try:
            _keep_alive_client.get(url)
        except Exception:
            pass
        rss_before = _rss_mb()
        try:
            ctypes.CDLL("libc.so.6").malloc_trim(0)
        except Exception:
            pass
        rss_after = _rss_mb()
        print(f"[keep-alive] RSS: {rss_before:.1f} → {rss_after:.1f} MB (freed {rss_before - rss_after:.1f} MB)")

threading.Thread(target=keep_alive, daemon=True).start()


_ingest_state = {"running": False, "result": None, "error": None}

@app.post("/admin/ingest")
def force_ingest(authorization: str = Header(...)):
    from routers.auth import get_user_id
    get_user_id(authorization)
    if _ingest_state["running"]:
        return {"success": True, "data": {"status": "already_running"}, "error": None}
    _ingest_state.update({"running": True, "result": None, "error": None})
    def _run():
        import gc
        import resource
        import ctypes
        rss_before = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        print(f"Ingest start — RSS: {rss_before} KB")
        try:
            from ingest_stores import check_and_ingest
            _ingest_state["result"] = check_and_ingest(force=True)
        except Exception as e:
            _ingest_state["error"] = str(e)
        finally:
            _ingest_state["running"] = False
            rss_peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
            gc.collect()
            try:
                ctypes.CDLL("libc.so.6").malloc_trim(0)
            except Exception:
                pass
            rss_after = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
            print(f"Ingest done — peak RSS: {rss_peak} KB, after trim: {rss_after} KB")
    threading.Thread(target=_run, daemon=True).start()
    return {"success": True, "data": {"status": "started"}, "error": None}

@app.get("/admin/ingest/status")
def ingest_status(authorization: str = Header(...)):
    from routers.auth import get_user_id
    get_user_id(authorization)
    return {"success": True, "data": _ingest_state, "error": None}


from pydantic import BaseModel


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
    from db import supabase_admin, claude

    system_prompt = """You are a friendly ShopRight help assistant. ShopRight is a mobile web app for mystery shoppers working with Smart Circle International. You know everything about this app and should guide users simply and clearly. Users are NOT technical — explain everything in plain language.

APP OVERVIEW:
ShopRight helps mystery shoppers record store visits, fill out vendor assessments, and generate weekly reports and monthly invoices that get emailed to Smart Circle.

TERMINOLOGY:
- Store = a physical retail location (e.g., Costco #1287)
- Vendor = a program/brand being assessed at a store (e.g., RTL-ATT-EDM)
- Assessment = the evaluation form filled out for each vendor
- Open = store or vendor not yet completed (green badge)
- Completed = store or vendor assessment submitted (blue badge)

COMPLETE WORKFLOW:
1. Home page: tap "Start Shopping" to go to the Stores page
2. Tap "Add Store" to add a store you're visiting
3. GPS finds nearby stores, or search by store number or retailer name
4. Select the store, then select a vendor program from the dropdown (or type a custom one)
5. Tap "Confirm Store & Add Vendor" to open the assessment form
6. Fill out the assessment form for that vendor
7. Tap "Review & Submit" — AI reviews your notes (if enabled)
8. Address any AI flags or tap "Submit Anyway"
9. Back on Stores page: "Add Another Vendor" at same store or "Close Store"
10. "Add Store" for next location
11. Weekly: tap Reports > Weekly Shop File to generate and email your report
12. Monthly: tap Reports > Monthly Invoice, enter mileage, send invoice

VENDOR PROGRAM SELECTION:
When adding a vendor, you'll see a dropdown with available programs including:
RTL-ATT-EDM, RS-CKE, RTL-Jacuzzi-Roadshow, RS-DS WATER-Primo and RSW, RTL-IME, RTL-SCI-HI Exit Fence, RTL-SCI-Multi Serv-Exit Fence, RTL-GDI-LeafGuard, RTL-GDI-LG Exit Fence, RTL-LEAF FILTER, RTL-Reborn-Roadshow
If the program you need isn't in the list, type it in the custom code field below the dropdown.

ASSESSMENT FORM:
- Reps Present: Pass or Fail. If Fail, skip to Visit Recap.
- If Pass: enter rep names (optional), rep count (required)
- 12 evaluation fields: all default to Pass. Only tap Fail or N/A for exceptions.
- Fail opens a required comment field — describe the issue
- Soft Selling: only applies to Water programs (RS-DS WATER-Primo and RSW)
- Resource Guide: only applies to Costco stores
- Visit Recap: describe the overall visit at the bottom
- Auto-saves every change — you won't lose work if the browser closes

NAVIGATION:
- Bottom bar: Home, Stores, Reports, Profile, Settings
- Blue ? button: opens this help chat on any page
- Tap the ShopRight logo on any page to go Home

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
- Weekly Shop File: generates an Excel file with all your completed vendor assessments for the week. Emailed to Smart Circle.
- Monthly Invoice: enter mileage per shopping day, pricing auto-calculated ($50 first vendor per store per day, $15 each additional). Emailed to Smart Circle.

PRICING:
- $50 for the first vendor at each store location per day
- $15 for each additional vendor at the same store on the same day

STORES:
The app has 236 stores across 6 retailers: Costco, Costco BC, Kroger - Fred Meyer, Lowe's Home Improvement, Sam's Club, and Target. If you can't find your store, search by store number or retailer name.

ROUTE PLANNER:
- Found in the bottom nav. Helps you plan your shopping day before you start.
- Paste an event email or SMS check-in text and the app parses out store and vendor data automatically.
- Filter stores by max distance from your start location and by city.
- Set a time window (start and end times) and tap "Optimize Route" — finds the fastest order based on real drive times.
- The optimized route shows estimated arrival/departure times at each stop, expected earnings, and drive times between stops.
- An interactive map displays your route on actual roads.
- "Accept Route" creates vendor assessments for each store so you're ready to start.
- "Assess Vendors" opens the assessment form for a store.
- "Skip" or "Remove" a stop to remove its vendor assessments. "Restore" brings them back.
- "Re-optimize Route" recalculates using the current time and live traffic.
- When all vendors at a store are submitted, the stop moves to the "Completed" section at the top of the route.
- No API key setup required — route optimization is built in.

ROUTE PLANNER STATUS LABELS:
- "Completed" (blue badge on a stop) = all vendor assessments at that store have been submitted. Your data is fully saved.
- "Open" (on a vendor row) = that vendor assessment has not been submitted yet.
- "Complete" (on a vendor row) = that vendor assessment has been submitted.
- If you see a stop marked Completed, your assessments are recorded — nothing is lost.

TROUBLESHOOTING:
- "Load failed": usually means the server is starting up. Wait 30 seconds and try again.
- Can't find a store: use the search box, try the store number
- GPS not working: allow location access in your phone's settings
- Voice input not working: only works in Chrome browser
- AI review not working: check your API key in Settings
- Program not in dropdown: select "Other (enter manually)" and type it

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
        if "start" in msg or "session" in msg or "begin" in msg or "shop" in msg:
            return {"success": True, "data": "To start shopping:\n\n1. Tap 'Start Shopping' on the Home page\n2. Tap 'Add Store'\n3. Allow GPS or search by store number\n4. Select the store, then pick a vendor program from the dropdown\n5. Tap 'Confirm Store & Add Vendor'\n6. Fill out the assessment form\n7. Submit, then add more vendors or close the store", "error": None}
        if "report" in msg or "shop file" in msg or "weekly" in msg:
            return {"success": True, "data": "To send your weekly report:\n\n1. Tap 'Reports' in the bottom nav\n2. Or tap 'Weekly Shop File' on the Home page\n3. Check the visits listed\n4. Enter the recipient email\n5. Tap 'Send Shop File'", "error": None}
        if "invoice" in msg or "monthly" in msg or "mileage" in msg:
            return {"success": True, "data": "To send your monthly invoice:\n\n1. Tap 'Monthly Invoice' on the Home page\n2. Enter your mileage for each shopping day\n3. Review the pricing ($50 first vendor/store/day, $15 additional)\n4. Enter the recipient email\n5. Tap 'Generate & Send Invoice'", "error": None}
        if "program" in msg or "vendor" in msg or "dropdown" in msg:
            return {"success": True, "data": "When adding a vendor, you'll see a dropdown with available programs like RTL-ATT-EDM, RS-CKE, etc.\n\nIf your program isn't listed, select 'Other (enter manually)' at the bottom of the dropdown and type it in.\n\nThe program identifies which vendor or brand you're assessing at the store.", "error": None}
        if "store" in msg or "location" in msg or "gps" in msg or "search" in msg:
            return {"success": True, "data": "To add a store:\n\n1. Tap 'Add Store' on the Stores page\n2. Allow GPS to find nearby stores, or tap 'Search instead'\n3. Search by store number (e.g., '63') or retailer name (e.g., 'Costco')\n4. Select the store and verify the address\n5. Pick a vendor program from the dropdown\n6. Tap 'Confirm Store & Add Vendor'", "error": None}
        return {"success": True, "data": "I can help with:\n\n- Adding stores and vendors\n- Filling out assessment forms\n- Selecting vendor programs\n- Setting up AI Review (API key)\n- Sending weekly reports\n- Sending monthly invoices\n- GPS and store search issues\n\nWhat would you like help with?", "error": None}

    try:
        text = claude(
            api_key=api_key,
            messages=[{"role": "user", "content": body.message}],
            max_tokens=400,
            system=system_prompt + context,
        )
        return {"success": True, "data": text, "error": None}
    except Exception:
        return {"success": True, "data": "Sorry, I couldn't process that right now. Try again in a moment.", "error": None}


@app.post("/contact")
def send_contact(body: ContactForm):
    import resend
    resend.api_key = os.getenv("RESEND_API_KEY")
    resend_from = f"{os.getenv('RESEND_FROM_NAME', 'ShopRight')} <{os.getenv('RESEND_FROM_EMAIL', 'onboarding@resend.dev')}>"
    try:
        resend.Emails.send({
            "from": resend_from,
            "to": ["j.eli.peterson@gmail.com"],
            "subject": f"Contact from {body.name} — Eli Peterson Consulting",
            "html": f"<p><strong>From:</strong> {body.name} ({body.email})</p><p>{body.message}</p>",
            "reply_to": body.email,
        })
        return {"success": True}
    except Exception:
        return {"success": False}
