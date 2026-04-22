from fastapi import APIRouter, Header, Query
from pydantic import BaseModel
from typing import Optional, List
from db import supabase_admin
from routers.auth import get_user_id
from routers.stores import ensure_coordinates
from datetime import datetime, date
import re

router = APIRouter(prefix="/route", tags=["route"])

KNOWN_RETAILERS = [
    "costco", "costco bc", "kroger - fred meyer", "kroger-fred meyer",
    "lowe's home improvement", "lowes home improvement", "lowe's",
    "target", "sam's club", "sams club",
]
STATES = ['OR', 'WA', 'CO', 'ID', 'MT', 'NV', 'UT', 'CA', 'AZ', 'NM', 'WY']


def parse_event_email(raw_text):
    """Parse pasted event email into a list of store/vendor entries.
    Uses retailer name detection to find entry boundaries, avoiding alignment issues."""
    lines = [l.strip() for l in raw_text.split('\n') if l.strip()]

    # Find entry start positions by detecting retailer names
    entry_starts = []
    for i, line in enumerate(lines):
        if any(line.lower().strip().startswith(r) for r in KNOWN_RETAILERS):
            # Make sure it's not a header line
            if 'retailer name' not in line.lower():
                entry_starts.append(i)

    entries = []
    for idx, start in enumerate(entry_starts):
        end = entry_starts[idx + 1] if idx + 1 < len(entry_starts) else len(lines)
        block = lines[start:end]

        if len(block) < 7:
            continue

        retailer = block[0]
        store_no = block[1]

        # Validate store number
        if not store_no.strip().replace('-', '').isdigit() or len(store_no.strip()) > 6:
            continue

        # Find the state line — scan for a 2-letter state code
        state_idx = None
        for j in range(2, min(len(block), 8)):
            if block[j].upper().strip() in STATES and len(block[j].strip()) <= 2:
                state_idx = j
                break

        if state_idx is None:
            continue

        city = block[state_idx - 1]
        address = block[2] if state_idx >= 4 else ''
        state = block[state_idx].upper().strip()

        remaining = block[state_idx + 1:]
        if len(remaining) < 2:
            continue

        zip_code = remaining[0]
        program = remaining[1] if len(remaining) > 1 else ''
        start_date = remaining[2] if len(remaining) > 2 else ''
        end_date = remaining[3] if len(remaining) > 3 else ''

        # Skip if end date is in the past
        if end_date:
            expired = False
            for fmt in ['%m/%d/%Y', '%m/%d/%y']:
                try:
                    end_dt = datetime.strptime(end_date.strip(), fmt)
                    if end_dt < datetime.now():
                        expired = True
                    break
                except ValueError:
                    continue
            if expired:
                continue

        # Skip non-program lines
        if not program or program.lower() in ['start date', 'end date', '']:
            continue

        entries.append({
            'retailer_name': retailer.strip(),
            'store_number': store_no.strip(),
            'address': address.strip(),
            'city': city.strip(),
            'state': state,
            'zip_code': zip_code.strip(),
            'program': program.strip(),
            'start_date': start_date.strip(),
            'end_date': end_date.strip(),
        })

    # Deduplicate by store + program
    seen = set()
    unique = []
    for e in entries:
        key = (e['retailer_name'], e['store_number'], e['program'])
        if key not in seen:
            seen.add(key)
            unique.append(e)

    return unique


def parse_checkin_text(raw_text):
    """Parse pasted check-in text message into confirmed store/vendor entries."""
    lines = [l.strip() for l in raw_text.split('\n') if l.strip()]

    skip_patterns = ['hi ', 'hey ', 'hello', 'here are', 'checked in', "i'll update",
                     '---', '+++', '++', 'update later', 'additional check']

    entries = []
    for line in lines:
        if any(p in line.lower() for p in skip_patterns):
            continue

        # Tab-delimited: Retailer\tStore#\tProgram\tCity\tState
        parts = re.split(r'\t+', line)
        if len(parts) >= 5:
            entries.append({
                'retailer_name': parts[0].strip(),
                'store_number': parts[1].strip(),
                'program': parts[2].strip(),
                'city': parts[3].strip(),
                'state': parts[4].strip().upper(),
            })

    seen = set()
    unique = []
    for e in entries:
        key = (e['retailer_name'], e['store_number'], e['program'])
        if key not in seen:
            seen.add(key)
            unique.append(e)

    return unique


def ai_parse_content(raw_text, content_type, api_key):
    """Use Claude AI to parse email or check-in text into structured data."""
    import anthropic
    import json

    if content_type == "email":
        prompt = f"""Extract all store/vendor entries from this email. Each entry should have:
- retailer_name (e.g., "Costco", "Kroger - Fred Meyer", "Lowe's Home Improvement", "Target", "Sam's Club")
- store_number (just the number)
- address (street address)
- city
- state (2-letter code)
- zip_code
- program (vendor program code like RTL-ATT-EDM, RS-CKE, RTL-LEAF FILTER, etc.)
- start_date (MM/DD/YYYY)
- end_date (MM/DD/YYYY)

Only include entries where the end_date is today or in the future (today is {datetime.now().strftime('%m/%d/%Y')}).
Only include entries that are staffed/active. Exclude entries marked as unstaffed, cancelled, or not staffed.
Ignore email headers, greetings, signatures, and image references.

Return ONLY a JSON array of objects. No explanation, no markdown code blocks, just the JSON array.

Email content:
{raw_text}"""
    else:
        prompt = f"""Extract all store check-in entries from this text message. Each entry should have:
- retailer_name (e.g., "Costco", "Kroger - Fred Meyer", "Lowe's Home Improvement", "Target", "Sam's Club")
- store_number (just the number)
- program (vendor program code)
- city
- state (2-letter code)

Ignore greetings, separators (--- or +++), and status messages.
If there are multiple messages separated by dividers, extract from ALL of them.

Return ONLY a JSON array of objects. No explanation, no markdown code blocks, just the JSON array.

Text message content:
{raw_text}"""

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}],
        )

        text = response.content[0].text.strip()
        # Extract JSON from response
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()
        if text.startswith("["):
            entries = json.loads(text)
            # Deduplicate
            seen = set()
            unique = []
            for e in entries:
                key = (e.get('retailer_name', ''), e.get('store_number', ''), e.get('program', ''))
                if key not in seen and key[0] and key[1]:
                    seen.add(key)
                    unique.append(e)
            return unique
    except Exception as e:
        pass

    return None


class ParseEmailRequest(BaseModel):
    raw_text: str


@router.post("/parse-email")
def parse_email(body: ParseEmailRequest, authorization: str = Header(...)):
    user_id = get_user_id(authorization)

    # Try AI parsing first if user has API key
    profile = supabase_admin.table("profiles").select("anthropic_api_key").eq("id", user_id).single().execute()
    api_key = profile.data.get("anthropic_api_key") if profile.data else None

    entries = None
    if api_key:
        entries = ai_parse_content(body.raw_text, "email", api_key)

    # Fall back to pattern parser
    if entries is None:
        entries = parse_event_email(body.raw_text)

    for entry in entries:
        store = supabase_admin.table("stores").select("*").eq(
            "store_number", entry["store_number"]
        ).eq("retailer_name", entry["retailer_name"]).limit(1).execute()
        if store.data:
            s = ensure_coordinates(store.data[0])
            entry["store_id"] = s["id"]
            entry["latitude"] = s.get("latitude")
            entry["longitude"] = s.get("longitude")
            if not entry.get("address") and s.get("address"):
                entry["address"] = s["address"]
            if not entry.get("city") and s.get("city"):
                entry["city"] = s["city"]

    now = datetime.now()
    visit_month = now.strftime("%Y-%m")
    history = supabase_admin.table("store_visit_history").select("*").eq(
        "user_id", user_id
    ).eq("visit_month", visit_month).execute()

    visit_counts = {}
    for h in (history.data or []):
        key = (h["retailer_name"], h["store_number"])
        visit_counts[key] = h["visit_count"]

    for entry in entries:
        key = (entry["retailer_name"], entry["store_number"])
        entry["monthly_visits"] = visit_counts.get(key, 0)
        entry["blocked"] = entry["monthly_visits"] >= 2

    return {"success": True, "data": entries, "error": None}


class ParseCheckinRequest(BaseModel):
    raw_text: str


@router.post("/parse-checkin")
def parse_checkin(body: ParseCheckinRequest, authorization: str = Header(...)):
    user_id = get_user_id(authorization)

    # Try AI parsing first
    profile = supabase_admin.table("profiles").select("anthropic_api_key").eq("id", user_id).single().execute()
    api_key = profile.data.get("anthropic_api_key") if profile.data else None

    entries = None
    if api_key:
        entries = ai_parse_content(body.raw_text, "checkin", api_key)

    if entries is None:
        entries = parse_checkin_text(body.raw_text)

    for entry in entries:
        store = supabase_admin.table("stores").select("*").eq(
            "store_number", entry["store_number"]
        ).eq("retailer_name", entry["retailer_name"]).limit(1).execute()
        if store.data:
            s = ensure_coordinates(store.data[0])
            entry["store_id"] = s["id"]
            entry["latitude"] = s.get("latitude")
            entry["longitude"] = s.get("longitude")
            entry["address"] = s.get("address", "")
            entry["city"] = s.get("city", "")
            entry["zip_code"] = s.get("zip_code", "")

    now = datetime.now()
    visit_month = now.strftime("%Y-%m")
    history = supabase_admin.table("store_visit_history").select("*").eq(
        "user_id", user_id
    ).eq("visit_month", visit_month).execute()

    visit_counts = {}
    for h in (history.data or []):
        key = (h["retailer_name"], h["store_number"])
        visit_counts[key] = h["visit_count"]

    for entry in entries:
        key = (entry["retailer_name"], entry["store_number"])
        entry["monthly_visits"] = visit_counts.get(key, 0)
        entry["blocked"] = entry["monthly_visits"] >= 2

    return {"success": True, "data": entries, "error": None}


class OptimizeRequest(BaseModel):
    stores: list
    start_address: str
    end_address: Optional[str] = None
    time_window_minutes: Optional[int] = None
    start_time: Optional[str] = None  # "HH:MM" format


@router.post("/optimize")
def optimize_route(body: OptimizeRequest, authorization: str = Header(...)):
    user_id = get_user_id(authorization)

    import os
    api_key = os.environ.get("OPENROUTESERVICE_API_KEY")
    if not api_key:
        return {"success": False, "data": None, "error": "Route optimization unavailable. Contact support."}

    end_address = body.end_address or body.start_address

    # Check for same-week and same-month visits to flag duplicates at vendor level
    all_visits = supabase_admin.table("vendor_visits").select(
        "retailer_name, store_number, program, visit_date"
    ).eq("user_id", user_id).execute()

    from datetime import timedelta

    today_dt = date.today()
    week_start = today_dt - timedelta(days=today_dt.weekday())
    week_end = week_start + timedelta(days=6)
    current_month = today_dt.strftime("%Y-%m")

    # Build per-vendor history: key = (retailer, store_number, program)
    vendor_history = {}
    for v in (all_visits.data or []):
        key = (v["retailer_name"], v["store_number"], v.get("program", ""))
        vd = v.get("visit_date", "")
        if not vd:
            continue
        if key not in vendor_history:
            vendor_history[key] = {"week_dates": [], "month_dates": []}
        try:
            visit_dt = datetime.strptime(vd, "%Y-%m-%d").date()
        except ValueError:
            continue
        if week_start <= visit_dt <= week_end and visit_dt != today_dt:
            vendor_history[key]["week_dates"].append(vd)
        if vd.startswith(current_month):
            vendor_history[key]["month_dates"].append(vd)

    # Attach flags per vendor (warn but never block)
    for s in body.stores:
        key = (s["retailer_name"], s["store_number"], s.get("program", ""))
        history = vendor_history.get(key, {})
        s["week_dates"] = history.get("week_dates", [])
        s["month_dates"] = history.get("month_dates", [])
        s["same_week"] = len(s["week_dates"]) > 0
        s["monthly_visits"] = len(s["month_dates"])

    candidate_stores = [s for s in body.stores if s.get("latitude")]

    if not candidate_stores:
        return {"success": True, "data": {"route": [], "summary": {"total_stops": 0, "total_vendors": 0, "total_earnings": 0, "total_time_min": 0, "total_miles": 0, "projected_rate_per_hour": 0}}, "error": None}

    # Group vendors by store location
    store_groups = {}
    for s in candidate_stores:
        key = (s["retailer_name"], s["store_number"])
        if key not in store_groups:
            store_groups[key] = {
                "retailer_name": s["retailer_name"],
                "store_number": s["store_number"],
                "address": s.get("address", ""),
                "city": s.get("city", ""),
                "state": s.get("state", ""),
                "latitude": s["latitude"],
                "longitude": s["longitude"],
                "vendors": [],
                "vendor_flags": {},
            }
        program = s.get("program", "")
        store_groups[key]["vendors"].append(program)
        flags = {}
        if s.get("same_week"):
            flags["same_week"] = True
            flags["week_dates"] = s.get("week_dates", [])
        if s.get("monthly_visits", 0) >= 2:
            flags["month_limit"] = True
            flags["month_dates"] = s.get("month_dates", [])
        if flags:
            store_groups[key]["vendor_flags"][program] = flags

    stores = list(store_groups.values())

    for store in stores:
        vendor_count = len(store["vendors"])
        store["earnings"] = 50 + (15 * (vendor_count - 1))
        store["est_minutes"] = 20 + (7.5 * (vendor_count - 1))

    import httpx
    import time

    num_stores = len(stores)

    # Geocode start and end addresses via Nominatim
    def _geocode(address):
        try:
            r = httpx.get("https://nominatim.openstreetmap.org/search", params={
                "q": address, "format": "json", "limit": 1,
            }, headers={"User-Agent": "ShopRight/1.0"}, timeout=10)
            results = r.json()
            if results:
                return [float(results[0]["lon"]), float(results[0]["lat"])]  # ORS: [lon, lat]
        except Exception:
            pass
        return None

    start_ll = _geocode(body.start_address)
    if not start_ll:
        return {"success": False, "data": None, "error": "Could not geocode start address. Try a more specific address."}

    if end_address != body.start_address:
        time.sleep(1)  # Nominatim rate limit: 1 req/sec
        end_ll = _geocode(end_address) or start_ll
    else:
        end_ll = start_ll

    # Build ORS locations: [start, store0..storeN-1, end]
    # ORS expects [longitude, latitude] (GeoJSON order)
    locations = [start_ll] + [[s["longitude"], s["latitude"]] for s in stores] + [end_ll]

    # sources: indices 0..num_stores (start + all stores)
    # destinations: indices 1..num_stores+1 (all stores + end)
    # This maps drive_times[(i, j)] directly to response[i][j]
    sources = list(range(num_stores + 1))
    destinations = list(range(1, num_stores + 2))

    drive_times = {}
    drive_distances = {}

    try:
        r = httpx.post(
            "https://api.openrouteservice.org/v2/matrix/driving-car",
            headers={
                "Authorization": api_key,
                "Content-Type": "application/json",
            },
            json={
                "locations": locations,
                "sources": sources,
                "destinations": destinations,
                "metrics": ["duration", "distance"],
            },
            timeout=30,
        )
        if r.status_code != 200:
            return {"success": False, "data": None, "error": f"Route service error: {r.status_code} — {r.text[:200]}"}

        matrix = r.json()
        for i, row in enumerate(matrix.get("durations", [])):
            for j, val in enumerate(row):
                drive_times[(i, j)] = (val / 60) if val is not None else 9999  # seconds → minutes
        for i, row in enumerate(matrix.get("distances", [])):
            for j, val in enumerate(row):
                drive_distances[(i, j)] = (val / 1609.34) if val is not None else 0  # meters → miles
    except Exception as e:
        return {"success": False, "data": None, "error": f"Failed to get distances: {str(e)}"}

    # Parse start time for schedule building
    start_hour, start_minute = 10, 0  # default 10:00 AM
    if body.start_time:
        try:
            parts = body.start_time.split(":")
            start_hour, start_minute = int(parts[0]), int(parts[1])
        except (ValueError, IndexError):
            pass

    def minutes_to_time(total_min):
        """Convert elapsed minutes from midnight to HH:MM AM/PM format."""
        h = int(total_min // 60) % 24
        m = int(total_min % 60)
        ampm = "AM" if h < 12 else "PM"
        display_h = h if h <= 12 else h - 12
        if display_h == 0:
            display_h = 12
        return f"{display_h}:{m:02d} {ampm}"

    # Greedy optimization: best earnings/minute order within time window
    # Never drops stores — includes all that fit, marks overflow separately
    max_minutes = body.time_window_minutes or 99999
    route = []
    overflow = []  # stores that don't fit in time window
    remaining = list(range(num_stores))
    current = 0
    elapsed = 0
    total_earnings_so_far = 0
    clock = start_hour * 60 + start_minute  # minutes from midnight

    while remaining:
        best_score = -1
        best_idx = None

        for idx in remaining:
            drive_min = drive_times.get((current, idx), 9999)
            store = stores[idx]
            time_at_store = drive_min + store["est_minutes"]
            return_from_store = drive_times.get((idx + 1, num_stores), 0)

            would_fit = (elapsed + time_at_store + return_from_store) <= max_minutes
            if not would_fit:
                continue

            score = store["earnings"] / max(time_at_store, 1)
            if score > best_score:
                best_score = score
                best_idx = idx

        if best_idx is None:
            # No more stores fit — remaining go to overflow
            for idx in remaining:
                store = stores[idx]
                drive_min = drive_times.get((current, idx), 0)
                store["drive_time_min"] = round(drive_min, 1)
                store["drive_distance_mi"] = round(drive_distances.get((current, idx), 0), 1)
                store["status"] = "overflow"
                overflow.append(store)
            break

        store = stores[best_idx]
        drive_min = drive_times.get((current, best_idx), 0)
        store["drive_time_min"] = round(drive_min, 1)
        store["drive_distance_mi"] = round(drive_distances.get((current, best_idx), 0), 1)
        store["status"] = "upcoming"

        # Schedule: arrival, assessment window, departure
        arrival = clock + drive_min
        store["est_arrival"] = minutes_to_time(arrival)
        store["est_depart"] = minutes_to_time(arrival + store["est_minutes"])

        elapsed += drive_min + store["est_minutes"]
        total_earnings_so_far += store["earnings"]
        clock = arrival + store["est_minutes"]
        route.append(store)
        remaining.remove(best_idx)
        current = best_idx + 1

    if route:
        last_store_idx = stores.index(route[-1])
        return_time = drive_times.get((last_store_idx + 1, num_stores), 0)
        return_distance = drive_distances.get((last_store_idx + 1, num_stores), 0)
    else:
        return_time = 0
        return_distance = 0

    total_earnings = sum(s["earnings"] for s in route)
    total_assess_time = sum(s["est_minutes"] for s in route)
    total_drive_time = sum(s["drive_time_min"] for s in route) + return_time
    total_time = total_assess_time + total_drive_time
    total_miles = sum(s["drive_distance_mi"] for s in route) + return_distance
    projected_rate = (total_earnings / max(total_time / 60, 0.01)) if total_time > 0 else 0

    # Schedule metadata
    depart_home = minutes_to_time(start_hour * 60 + start_minute)
    arrive_home = minutes_to_time(clock + return_time)

    summary = {
        "total_stops": len(route),
        "total_vendors": sum(len(s["vendors"]) for s in route),
        "total_earnings": round(total_earnings, 2),
        "total_time_min": round(total_time, 1),
        "total_miles": round(total_miles, 1),
        "projected_rate_per_hour": round(projected_rate, 2),
        "return_drive_min": round(return_time, 1),
        "return_drive_mi": round(return_distance, 1),
        "depart_home": depart_home,
        "arrive_home": arrive_home,
        "time_window_minutes": max_minutes if max_minutes < 99999 else None,
        "overflow_count": len(overflow),
    }

    return {"success": True, "data": {"route": route, "overflow": overflow, "summary": summary}, "error": None}


@router.get("/geocode")
def geocode_address(address: str = Query(...), authorization: str = Header(...)):
    get_user_id(authorization)
    import httpx
    try:
        r = httpx.get("https://nominatim.openstreetmap.org/search", params={
            "q": address, "format": "json", "limit": 1,
        }, headers={"User-Agent": "ShopRight/1.0"}, timeout=10)
        results = r.json()
        if results:
            return {"success": True, "data": {"latitude": float(results[0]["lat"]), "longitude": float(results[0]["lon"])}, "error": None}
        return {"success": False, "data": None, "error": "Address not found"}
    except Exception as e:
        return {"success": False, "data": None, "error": str(e)}


class SavePlanRequest(BaseModel):
    plan_date: str
    start_address: str
    end_address: Optional[str] = None
    raw_email_input: Optional[str] = None
    stores_data: Optional[list] = None


@router.post("/plan")
def save_plan(body: SavePlanRequest, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    plan = {
        "user_id": user_id,
        "plan_date": body.plan_date,
        "start_address": body.start_address,
        "end_address": body.end_address or body.start_address,
        "updated_at": datetime.utcnow().isoformat(),
    }
    if body.raw_email_input:
        plan["raw_email_input"] = body.raw_email_input
    if body.stores_data:
        plan["stores_data"] = body.stores_data

    result = supabase_admin.table("route_plans").upsert(
        plan, on_conflict="user_id,plan_date"
    ).execute()
    return {"success": True, "data": result.data[0] if result.data else None, "error": None}


@router.get("/plan/{plan_date}")
def get_plan(plan_date: str, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    result = supabase_admin.table("route_plans").select("*").eq(
        "user_id", user_id
    ).eq("plan_date", plan_date).limit(1).execute()
    if result.data:
        return {"success": True, "data": result.data[0], "error": None}
    return {"success": True, "data": None, "error": None}


@router.post("/plan/{plan_date}/complete-stop")
def complete_stop(plan_date: str, store_number: str = Query(...), retailer_name: str = Query(...), authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    visit_month = datetime.now().strftime("%Y-%m")

    existing = supabase_admin.table("store_visit_history").select("*").eq(
        "user_id", user_id
    ).eq("store_number", store_number).eq("retailer_name", retailer_name).eq(
        "visit_month", visit_month
    ).limit(1).execute()

    if existing.data:
        supabase_admin.table("store_visit_history").update({
            "visit_count": existing.data[0]["visit_count"] + 1
        }).eq("id", existing.data[0]["id"]).execute()
    else:
        supabase_admin.table("store_visit_history").insert({
            "user_id": user_id,
            "store_number": store_number,
            "retailer_name": retailer_name,
            "visit_month": visit_month,
            "visit_count": 1,
        }).execute()

    return {"success": True, "data": "Stop completed", "error": None}


@router.get("/visit-history")
def get_visit_history(authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    visit_month = datetime.now().strftime("%Y-%m")
    result = supabase_admin.table("store_visit_history").select("*").eq(
        "user_id", user_id
    ).eq("visit_month", visit_month).execute()
    return {"success": True, "data": result.data or [], "error": None}
