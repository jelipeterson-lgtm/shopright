from fastapi import APIRouter, Header, Query
from pydantic import BaseModel
from db import supabase_admin
from math import radians, cos, sin, asin, sqrt
import httpx

router = APIRouter(prefix="/stores", tags=["stores"])


def ensure_coordinates(store):
    """Auto-geocode a store if it has null lat/lng. Updates DB in place."""
    if store.get("latitude") and store.get("longitude"):
        return store
    address = store.get("address", "")
    city = store.get("city", "")
    state = store.get("state", "")
    zip_code = store.get("zip_code", "")
    if not (address or city):
        return store
    full_address = f"{address}, {city}, {state} {zip_code}".strip(", ")
    try:
        r = httpx.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": full_address, "format": "json", "limit": 1},
            headers={"User-Agent": "ShopRight/1.0"},
            timeout=10,
        )
        data = r.json()
        if data:
            lat, lon = float(data[0]["lat"]), float(data[0]["lon"])
            store["latitude"] = lat
            store["longitude"] = lon
            if store.get("id"):
                supabase_admin.table("stores").update(
                    {"latitude": lat, "longitude": lon}
                ).eq("id", store["id"]).execute()
    except Exception:
        pass
    return store


def haversine(lat1, lon1, lat2, lon2):
    """Calculate distance in miles between two lat/lng points."""
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 2 * 3956 * asin(sqrt(a))  # 3956 = Earth radius in miles


@router.get("/nearby")
def get_nearby_stores(lat: float = Query(...), lng: float = Query(...)):
    """Return up to 3 stores within 1 mile, sorted by distance."""
    result = supabase_admin.table("stores").select("*").not_.is_("latitude", "null").limit(500).execute()
    stores = result.data or []

    with_distance = []
    for store in stores:
        dist = haversine(lat, lng, store["latitude"], store["longitude"])
        if dist <= 1.0:
            store["distance_miles"] = round(dist, 2)
            with_distance.append(store)

    with_distance.sort(key=lambda s: s["distance_miles"])
    return {"success": True, "data": with_distance[:3], "error": None}


@router.get("/search")
def search_stores(q: str = Query(..., min_length=1)):
    """Search stores by any field: retailer name, store number, city, address, zip."""
    query = q.strip()

    # Load all stores and search across multiple fields
    result = supabase_admin.table("stores").select("*").limit(500).execute()
    stores = result.data or []

    import re
    # Strip special characters like # from search terms
    cleaned = re.sub(r'[#\-.,]', ' ', query.lower())
    terms = [t for t in cleaned.split() if t]
    matches = []
    for store in stores:
        searchable = " ".join([
            store.get("retailer_name", ""),
            store.get("store_number", ""),
            store.get("address", ""),
            store.get("city", ""),
            store.get("state", ""),
            store.get("zip_code", ""),
        ]).lower()
        if all(term in searchable for term in terms):
            matches.append(store)

    # Sort: exact store number match first, then by retailer + number
    matches.sort(key=lambda s: (
        0 if s.get("store_number", "").lower() == query.lower() else 1,
        s.get("retailer_name", ""),
        s.get("store_number", ""),
    ))

    # Auto-geocode any matches missing coordinates
    for m in matches[:25]:
        ensure_coordinates(m)
    return {"success": True, "data": matches[:25], "error": None}


@router.post("/fix-coords")
def fix_missing_coordinates():
    """Geocode stores that have null lat/lng."""
    import httpx
    import time as _time

    result = supabase_admin.table("stores").select("*").is_("latitude", "null").execute()
    stores = result.data or []

    if not stores:
        return {"success": True, "data": {"fixed": 0, "total_missing": 0}, "error": None}

    fixed = 0
    for store in stores:
        full_address = f"{store.get('address', '')}, {store.get('city', '')}, {store.get('state', '')} {store.get('zip_code', '')}"
        try:
            r = httpx.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": full_address, "format": "json", "limit": 1},
                headers={"User-Agent": "ShopRight/1.0"},
                timeout=10,
            )
            data = r.json()
            if data:
                lat, lon = float(data[0]["lat"]), float(data[0]["lon"])
                supabase_admin.table("stores").update(
                    {"latitude": lat, "longitude": lon}
                ).eq("id", store["id"]).execute()
                fixed += 1
            _time.sleep(1.1)  # Nominatim rate limit
        except Exception:
            pass

    return {"success": True, "data": {"fixed": fixed, "total_missing": len(stores)}, "error": None}


class AddStoreRequest(BaseModel):
    retailer_name: str
    store_number: str
    address: str
    city: str
    state: str
    zip_code: str = ""


@router.post("/add")
def add_store(body: AddStoreRequest, authorization: str = Header(...)):
    """Manually add or update a store in the directory, with auto-geocoding."""
    from routers.auth import get_user_id
    get_user_id(authorization)  # auth check

    store = {
        "retailer_name": body.retailer_name.strip(),
        "store_number": body.store_number.strip(),
        "address": body.address.strip(),
        "city": body.city.strip(),
        "state": body.state.strip().upper(),
        "zip_code": body.zip_code.strip(),
    }

    # Geocode the address
    import time as _time
    candidates = [
        f"{store['address']}, {store['city']}, {store['state']} {store['zip_code']}",
        f"{store['address']}, {store['city']}, {store['state']}",
        f"{store['city']}, {store['state']} {store['zip_code']}",
    ]
    lat, lon = None, None
    for q in candidates:
        try:
            r = httpx.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": q, "format": "json", "limit": 1},
                headers={"User-Agent": "ShopRight/1.0 (shopright-api.onrender.com)"},
                timeout=10,
            )
            data = r.json()
            if data:
                lat, lon = float(data[0]["lat"]), float(data[0]["lon"])
                break
        except Exception:
            pass
        _time.sleep(1.1)

    if lat:
        store["latitude"] = lat
        store["longitude"] = lon

    result = supabase_admin.table("stores").upsert(
        store, on_conflict="retailer_name,store_number"
    ).execute()

    saved = result.data[0] if result.data else store
    return {
        "success": True,
        "data": {**saved, "geocoded": lat is not None},
        "error": None,
    }


@router.delete("/{store_id}")
def delete_store(store_id: int, authorization: str = Header(...)):
    """Delete a store from the directory by ID."""
    from routers.auth import get_user_id
    get_user_id(authorization)
    supabase_admin.table("stores").delete().eq("id", store_id).execute()
    return {"success": True, "data": None, "error": None}


@router.get("/programs")
def get_programs():
    """Get all available program codes from the programs table."""
    result = supabase_admin.table("programs").select("code").order("code").execute()
    programs = [row["code"] for row in (result.data or [])]
    return {"success": True, "data": programs, "error": None}
