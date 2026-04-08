from fastapi import APIRouter, Header, Query
from pydantic import BaseModel
from typing import Optional, List
from db import supabase_admin, SUPABASE_URL, SUPABASE_ANON_KEY
from routers.auth import get_user_id
from datetime import date, time, datetime

router = APIRouter(prefix="/visits", tags=["visits"])


class CreateVisit(BaseModel):
    store_id: int
    retailer_name: str
    store_number: str
    program: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    visit_date: str  # YYYY-MM-DD
    visit_time: str  # HH:MM
    session_date: str  # YYYY-MM-DD
    is_manual: Optional[bool] = False


class UpdateVisit(BaseModel):
    reps_present: Optional[str] = None
    rep_names: Optional[str] = None
    rep_description: Optional[str] = None
    rep_count: Optional[int] = None
    rep_count_reason: Optional[str] = None
    eval_engaging: Optional[str] = None
    eval_engaging_comment: Optional[str] = None
    eval_greeting: Optional[str] = None
    eval_greeting_comment: Optional[str] = None
    eval_one_no: Optional[str] = None
    eval_one_no_comment: Optional[str] = None
    eval_pushy: Optional[str] = None
    eval_pushy_comment: Optional[str] = None
    eval_clogging: Optional[str] = None
    eval_clogging_comment: Optional[str] = None
    eval_leaning: Optional[str] = None
    eval_leaning_comment: Optional[str] = None
    eval_food_drink: Optional[str] = None
    eval_food_drink_comment: Optional[str] = None
    eval_dress_code: Optional[str] = None
    eval_dress_code_comment: Optional[str] = None
    eval_name_badge: Optional[str] = None
    eval_name_badge_comment: Optional[str] = None
    eval_badge_location_pass: Optional[str] = None
    eval_badge_location_comment: Optional[str] = None
    eval_badge_where: Optional[str] = None
    eval_other_area: Optional[str] = None
    eval_other_area_comment: Optional[str] = None
    eval_other_store_areas: Optional[str] = None
    eval_other_store_areas_comment: Optional[str] = None
    eval_soft_selling: Optional[str] = None
    eval_soft_selling_comment: Optional[str] = None
    eval_resource_guide: Optional[str] = None
    visit_recap: Optional[str] = None
    visit_time: Optional[str] = None
    status: Optional[str] = None
    stop_open: Optional[bool] = None


@router.post("")
def create_visit(body: CreateVisit, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    visit = {
        "user_id": user_id,
        "store_id": body.store_id,
        "retailer_name": body.retailer_name,
        "store_number": body.store_number,
        "program": body.program,
        "address": body.address,
        "city": body.city,
        "state": body.state,
        "visit_date": body.visit_date,
        "visit_time": body.visit_time,
        "session_date": body.session_date,
        "status": "Draft",
        "stop_open": True,
    }
    result = supabase_admin.table("vendor_visits").insert(visit).execute()
    return {"success": True, "data": result.data[0] if result.data else None, "error": None}


class BatchCreateVisit(BaseModel):
    stores: list  # List of route stores with vendors
    session_date: str  # YYYY-MM-DD


@router.post("/batch")
def batch_create_visits(body: BatchCreateVisit, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    now = datetime.utcnow()
    visit_time = now.strftime("%H:%M")

    # Check for existing visits on this date to avoid duplicates
    existing = supabase_admin.table("vendor_visits").select(
        "retailer_name, store_number, program"
    ).eq("user_id", user_id).eq("session_date", body.session_date).execute()

    existing_keys = set()
    for v in (existing.data or []):
        existing_keys.add((v["retailer_name"], v["store_number"], v["program"]))

    created = []
    skipped = 0
    for store in body.stores:
        vendors = store.get("vendors", [])
        if not vendors:
            continue
        for program in vendors:
            key = (store["retailer_name"], store["store_number"], program)
            if key in existing_keys:
                skipped += 1
                continue
            visit = {
                "user_id": user_id,
                "store_id": store.get("store_id"),
                "retailer_name": store["retailer_name"],
                "store_number": store["store_number"],
                "program": program,
                "address": store.get("address", ""),
                "city": store.get("city", ""),
                "state": store.get("state", ""),
                "visit_date": body.session_date,
                "visit_time": visit_time,
                "session_date": body.session_date,
                "status": "Draft",
                "stop_open": True,
            }
            result = supabase_admin.table("vendor_visits").insert(visit).execute()
            if result.data:
                created.append(result.data[0])
                existing_keys.add(key)

    return {
        "success": True,
        "data": {"created": len(created), "skipped": skipped, "visits": created},
        "error": None,
    }


@router.get("")
def get_visits(
    authorization: str = Header(...),
    session_date: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
):
    user_id = get_user_id(authorization)
    query = supabase_admin.table("vendor_visits").select("*").eq("user_id", user_id)
    if session_date:
        query = query.eq("session_date", session_date)
    if status:
        query = query.eq("status", status)
    result = query.order("created_at", desc=False).execute()
    return {"success": True, "data": result.data or [], "error": None}


@router.get("/{visit_id}")
def get_visit(visit_id: str, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    result = (
        supabase_admin.table("vendor_visits")
        .select("*")
        .eq("id", visit_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    return {"success": True, "data": result.data, "error": None}


@router.put("/{visit_id}")
def update_visit(visit_id: str, body: UpdateVisit, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        return {"success": True, "data": None, "error": "No fields to update"}
    updates["updated_at"] = datetime.utcnow().isoformat()
    result = (
        supabase_admin.table("vendor_visits")
        .update(updates)
        .eq("id", visit_id)
        .eq("user_id", user_id)
        .execute()
    )
    return {"success": True, "data": result.data[0] if result.data else None, "error": None}


@router.post("/{visit_id}/complete")
def complete_visit(visit_id: str, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    result = (
        supabase_admin.table("vendor_visits")
        .update({"status": "Complete", "updated_at": datetime.utcnow().isoformat()})
        .eq("id", visit_id)
        .eq("user_id", user_id)
        .execute()
    )
    return {"success": True, "data": result.data[0] if result.data else None, "error": None}


@router.post("/{visit_id}/unlock")
def unlock_visit(visit_id: str, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    result = (
        supabase_admin.table("vendor_visits")
        .update({"status": "Draft", "updated_at": datetime.utcnow().isoformat()})
        .eq("id", visit_id)
        .eq("user_id", user_id)
        .execute()
    )
    return {"success": True, "data": result.data[0] if result.data else None, "error": None}


@router.post("/close-stop")
def close_stop(
    store_number: str = Query(...),
    retailer_name: str = Query(...),
    session_date: str = Query(...),
    authorization: str = Header(...),
):
    """Close a stop — fails if any Draft visits exist at this store today."""
    user_id = get_user_id(authorization)

    # Check for drafts
    drafts = (
        supabase_admin.table("vendor_visits")
        .select("id")
        .eq("user_id", user_id)
        .eq("store_number", store_number)
        .eq("retailer_name", retailer_name)
        .eq("session_date", session_date)
        .eq("status", "Draft")
        .execute()
    )
    if drafts.data:
        return {
            "success": False,
            "data": None,
            "error": f"You have {len(drafts.data)} unfinished visit(s) — finish or discard before closing.",
        }

    # Close the stop
    supabase_admin.table("vendor_visits").update({"stop_open": False}).eq(
        "user_id", user_id
    ).eq("store_number", store_number).eq("retailer_name", retailer_name).eq(
        "session_date", session_date
    ).execute()

    return {"success": True, "data": "Stop closed", "error": None}


@router.get("/check/open-stops")
def check_open_stops(session_date: str = Query(...), authorization: str = Header(...)):
    """Check if any stops are still open today."""
    user_id = get_user_id(authorization)
    result = (
        supabase_admin.table("vendor_visits")
        .select("retailer_name, store_number")
        .eq("user_id", user_id)
        .eq("session_date", session_date)
        .eq("stop_open", True)
        .execute()
    )
    # Deduplicate stops
    open_stops = []
    seen = set()
    for row in result.data or []:
        key = (row["retailer_name"], row["store_number"])
        if key not in seen:
            seen.add(key)
            open_stops.append({"retailer_name": row["retailer_name"], "store_number": row["store_number"]})

    return {"success": True, "data": open_stops, "error": None}


@router.delete("/{visit_id}")
def discard_visit(visit_id: str, authorization: str = Header(...)):
    """Delete a visit (Draft or Complete)."""
    user_id = get_user_id(authorization)

    supabase_admin.table("vendor_visits").delete().eq("id", visit_id).eq("user_id", user_id).execute()
    return {"success": True, "data": "Visit discarded", "error": None}
