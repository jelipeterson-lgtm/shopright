from fastapi import APIRouter, Query
from db import supabase_admin
from math import radians, cos, sin, asin, sqrt

router = APIRouter(prefix="/stores", tags=["stores"])


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
    result = supabase_admin.table("stores").select("*").not_.is_("latitude", "null").execute()
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
    """Search stores by retailer name or store number."""
    query = q.strip().lower()

    # Try store number first (exact match)
    result = supabase_admin.table("stores").select("*").eq("store_number", query).execute()
    if result.data:
        return {"success": True, "data": result.data, "error": None}

    # Text search on retailer name
    result = supabase_admin.table("stores").select("*").ilike("retailer_name", f"%{query}%").execute()
    return {"success": True, "data": result.data or [], "error": None}


@router.get("/programs")
def get_programs():
    """Get all available program codes from the programs table."""
    result = supabase_admin.table("programs").select("code").order("code").execute()
    programs = [row["code"] for row in (result.data or [])]
    return {"success": True, "data": programs, "error": None}
