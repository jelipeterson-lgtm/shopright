from fastapi import APIRouter, Header, Query
from pydantic import BaseModel
from typing import Optional, List
from db import supabase_admin
from routers.auth import get_user_id
from datetime import datetime, date
import re

router = APIRouter(prefix="/route", tags=["route"])


def parse_event_email(raw_text):
    """Parse pasted event email into a list of store/vendor entries."""
    lines = [l.strip() for l in raw_text.split('\n') if l.strip()]

    # Remove header row if present
    header_keywords = ['retailer name', 'store no', 'address', 'city', 'state', 'zip code', 'event program']
    lines = [l for l in lines if not any(k in l.lower() for k in header_keywords)]

    # Remove greeting, signature, image references
    skip_patterns = ['hey ', 'hi ', 'hello', 'sending over', 'please let us know', 'updated list',
                     'image00', '.jpg', '.png', 'phoebe foss', 'smart circle', 'pfoss@',
                     'warning:', 'confidential', 'mikee if', "i'll update", 'www.smartcircle']
    lines = [l for l in lines if not any(p in l.lower() for p in skip_patterns)]

    # Parse entries — each entry is 9 fields in sequence:
    # Retailer Name, Store No, Address, City, State, Zip, Program, Start Date, End Date
    entries = []
    i = 0
    while i + 8 < len(lines):
        retailer = lines[i]
        store_no = lines[i + 1]
        address = lines[i + 2]
        city = lines[i + 3]
        state = lines[i + 4]
        zip_code = lines[i + 5]
        program = lines[i + 6]
        start_date = lines[i + 7]
        end_date = lines[i + 8]

        # Validate this looks like a real entry
        if state.upper() in ['OR', 'WA', 'CO', 'ID', 'MT', 'NV', 'UT', 'CA'] and len(store_no) <= 5:
            # Check if dates are within current range
            try:
                end_dt = datetime.strptime(end_date, '%m/%d/%Y')
                if end_dt >= datetime.now():
                    entries.append({
                        'retailer_name': retailer.strip(),
                        'store_number': store_no.strip(),
                        'address': address.strip(),
                        'city': city.strip(),
                        'state': state.strip().upper(),
                        'zip_code': zip_code.strip(),
                        'program': program.strip(),
                        'start_date': start_date,
                        'end_date': end_date,
                    })
            except ValueError:
                pass

        i += 9

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

    # Remove greeting/separator lines
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

    # Deduplicate
    seen = set()
    unique = []
    for e in entries:
        key = (e['retailer_name'], e['store_number'], e['program'])
        if key not in seen:
            seen.add(key)
            unique.append(e)

    return unique


class ParseEmailRequest(BaseModel):
    raw_text: str


@router.post("/parse-email")
def parse_email(body: ParseEmailRequest, authorization: str = Header(...)):
    """Parse pasted event email and return extracted stores/vendors."""
    user_id = get_user_id(authorization)
    entries = parse_event_email(body.raw_text)

    # Enrich with store coordinates from database
    for entry in entries:
        store = supabase_admin.table("stores").select("id, latitude, longitude, address").eq(
            "store_number", entry["store_number"]
        ).eq("retailer_name", entry["retailer_name"]).limit(1).execute()
        if store.data:
            entry["store_id"] = store.data[0]["id"]
            entry["latitude"] = store.data[0].get("latitude")
            entry["longitude"] = store.data[0].get("longitude")
            if not entry.get("address") and store.data[0].get("address"):
                entry["address"] = store.data[0]["address"]

    # Check monthly visit counts
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
    """Parse pasted check-in text and return confirmed stores."""
    user_id = get_user_id(authorization)
    entries = parse_checkin_text(body.raw_text)

    # Enrich with store coordinates
    for entry in entries:
        store = supabase_admin.table("stores").select("id, latitude, longitude, address, zip_code").eq(
            "store_number", entry["store_number"]
        ).eq("retailer_name", entry["retailer_name"]).limit(1).execute()
        if store.data:
            entry["store_id"] = store.data[0]["id"]
            entry["latitude"] = store.data[0].get("latitude")
            entry["longitude"] = store.data[0].get("longitude")
            entry["address"] = store.data[0].get("address", "")
            entry["zip_code"] = store.data[0].get("zip_code", "")

    # Check monthly visit counts
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
    stores: list  # list of store entries with lat/lng
    start_address: str
    end_address: Optional[str] = None


@router.post("/optimize")
def optimize_route(body: OptimizeRequest, authorization: str = Header(...)):
    """Optimize route order using Google Maps Distance Matrix."""
    user_id = get_user_id(authorization)

    # Get user's Google Maps API key
    profile = supabase_admin.table("profiles").select("google_maps_api_key").eq("id", user_id).single().execute()
    api_key = profile.data.get("google_maps_api_key") if profile.data else None

    if not api_key:
        return {"success": False, "data": None, "error": "Google Maps API key required. Set it up in Settings."}

    end_address = body.end_address or body.start_address

    # Filter to non-blocked stores with coordinates
    candidate_stores = [s for s in body.stores if not s.get("blocked") and s.get("latitude")]

    if not candidate_stores:
        return {"success": True, "data": {"route": [], "summary": {}}, "error": None}

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
            }
        store_groups[key]["vendors"].append(s.get("program", ""))

    stores = list(store_groups.values())

    # Calculate earnings and time per store
    for store in stores:
        vendor_count = len(store["vendors"])
        store["earnings"] = 50 + (15 * (vendor_count - 1))
        store["est_minutes"] = 20 + (7.5 * (vendor_count - 1))

    # Get distance matrix from Google Maps
    import httpx

    origins = [body.start_address] + [f"{s['latitude']},{s['longitude']}" for s in stores]
    destinations = [f"{s['latitude']},{s['longitude']}" for s in stores] + [end_address]

    try:
        r = httpx.get(
            "https://maps.googleapis.com/maps/api/distancematrix/json",
            params={
                "origins": "|".join(origins),
                "destinations": "|".join(destinations),
                "key": api_key,
                "departure_time": "now",
                "traffic_model": "best_guess",
            },
            timeout=30,
        )
        matrix = r.json()

        if matrix.get("status") != "OK":
            return {"success": False, "data": None, "error": f"Google Maps error: {matrix.get('status')}"}
    except Exception as e:
        return {"success": False, "data": None, "error": f"Failed to get distances: {str(e)}"}

    # Extract drive times (in minutes)
    rows = matrix.get("rows", [])
    num_stores = len(stores)

    # Build drive time matrix
    # rows[0] = from start to each store + end
    # rows[1..n] = from each store to each store + end
    drive_times = {}
    drive_distances = {}

    for i, row in enumerate(rows):
        elements = row.get("elements", [])
        for j, elem in enumerate(elements):
            if elem.get("status") == "OK":
                duration = elem.get("duration_in_traffic", elem.get("duration", {}))
                drive_times[(i, j)] = duration.get("value", 9999) / 60  # seconds to minutes
                drive_distances[(i, j)] = elem.get("distance", {}).get("value", 0) / 1609.34  # meters to miles
            else:
                drive_times[(i, j)] = 9999
                drive_distances[(i, j)] = 0

    # Greedy optimization: pick best next store by earnings per time
    route = []
    remaining = list(range(num_stores))
    current = 0  # start position (index 0 in origins)

    while remaining:
        best_score = -1
        best_idx = None

        for idx in remaining:
            drive_min = drive_times.get((current, idx), 9999)
            store = stores[idx]
            total_time = drive_min + store["est_minutes"]
            score = store["earnings"] / max(total_time, 1)

            if score > best_score:
                best_score = score
                best_idx = idx

        if best_idx is None:
            break

        store = stores[best_idx]
        drive_min = drive_times.get((current, best_idx), 0)
        drive_mi = drive_distances.get((current, best_idx), 0)

        store["drive_time_min"] = round(drive_min, 1)
        store["drive_distance_mi"] = round(drive_mi, 1)
        store["status"] = "upcoming"

        route.append(store)
        remaining.remove(best_idx)
        current = best_idx + 1  # +1 because origin[0] is start address

    # Add return drive time
    if route:
        last_store_idx = stores.index(route[-1])
        return_time = drive_times.get((last_store_idx + 1, num_stores), 0)
        return_distance = drive_distances.get((last_store_idx + 1, num_stores), 0)
    else:
        return_time = 0
        return_distance = 0

    # Calculate summary
    total_earnings = sum(s["earnings"] for s in route)
    total_assess_time = sum(s["est_minutes"] for s in route)
    total_drive_time = sum(s["drive_time_min"] for s in route) + return_time
    total_time = total_assess_time + total_drive_time
    total_miles = sum(s["drive_distance_mi"] for s in route) + return_distance
    projected_rate = (total_earnings / max(total_time / 60, 0.01)) if total_time > 0 else 0

    summary = {
        "total_stops": len(route),
        "total_vendors": sum(len(s["vendors"]) for s in route),
        "total_earnings": round(total_earnings, 2),
        "total_time_min": round(total_time, 1),
        "total_miles": round(total_miles, 1),
        "projected_rate_per_hour": round(projected_rate, 2),
        "return_drive_min": round(return_time, 1),
        "return_drive_mi": round(return_distance, 1),
    }

    return {"success": True, "data": {"route": route, "summary": summary}, "error": None}


class SavePlanRequest(BaseModel):
    plan_date: str
    start_address: str
    end_address: Optional[str] = None
    raw_email_input: Optional[str] = None
    stores_data: Optional[list] = None


@router.post("/plan")
def save_plan(body: SavePlanRequest, authorization: str = Header(...)):
    """Save or update a route plan for a date."""
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
    """Get saved route plan for a date."""
    user_id = get_user_id(authorization)
    result = supabase_admin.table("route_plans").select("*").eq(
        "user_id", user_id
    ).eq("plan_date", plan_date).limit(1).execute()

    if result.data:
        return {"success": True, "data": result.data[0], "error": None}
    return {"success": True, "data": None, "error": None}


@router.post("/plan/{plan_date}/complete-stop")
def complete_stop(plan_date: str, store_number: str = Query(...), retailer_name: str = Query(...), authorization: str = Header(...)):
    """Mark a store as completed on the route and update visit history."""
    user_id = get_user_id(authorization)
    visit_month = datetime.now().strftime("%Y-%m")

    # Update visit history
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
    """Get monthly visit counts for current month."""
    user_id = get_user_id(authorization)
    visit_month = datetime.now().strftime("%Y-%m")

    result = supabase_admin.table("store_visit_history").select("*").eq(
        "user_id", user_id
    ).eq("visit_month", visit_month).execute()

    return {"success": True, "data": result.data or [], "error": None}
