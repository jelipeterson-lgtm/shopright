from fastapi import APIRouter, Header, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
from db import supabase_admin
from routers.auth import get_user_id
from excel import generate_shop_file, generate_invoice
from datetime import datetime, timedelta
import resend
import os
import base64

resend.api_key = os.getenv("RESEND_API_KEY")

router = APIRouter(prefix="/reports", tags=["reports"])


def get_iso_week_dates(year, week):
    """Get Monday and Sunday of an ISO week."""
    jan4 = datetime(year, 1, 4)
    start = jan4 - timedelta(days=jan4.isoweekday() - 1) + timedelta(weeks=week - 1)
    end = start + timedelta(days=6)
    return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")


@router.get("/weekly")
def get_weekly_visits(
    year: int = Query(...),
    week: int = Query(...),
    authorization: str = Header(...),
):
    """Get all Complete visits for a given ISO week."""
    user_id = get_user_id(authorization)
    start_date, end_date = get_iso_week_dates(year, week)

    result = (
        supabase_admin.table("vendor_visits")
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "Complete")
        .gte("visit_date", start_date)
        .lte("visit_date", end_date)
        .order("visit_date")
        .order("visit_time")
        .execute()
    )
    return {"success": True, "data": result.data or [], "error": None}


@router.get("/generate/shopfile")
def generate_shopfile_endpoint(
    year: int = Query(...),
    week: int = Query(...),
    authorization: str = Header(...),
):
    """Generate and return Shop File .xlsx for a given ISO week."""
    user_id = get_user_id(authorization)
    start_date, end_date = get_iso_week_dates(year, week)

    visits = (
        supabase_admin.table("vendor_visits")
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "Complete")
        .gte("visit_date", start_date)
        .lte("visit_date", end_date)
        .order("visit_date")
        .order("visit_time")
        .execute()
    )

    if not visits.data:
        return {"success": False, "data": None, "error": "No complete visits for this week"}

    profile = supabase_admin.table("profiles").select("full_name").eq("id", user_id).single().execute()
    first_name = (profile.data.get("full_name") or "Shopper").split()[0]

    output, filename = generate_shop_file(visits.data, first_name)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


class SendShopFileRequest(BaseModel):
    year: int
    week: int
    recipient_email: str


@router.post("/send/shopfile")
def send_shopfile(body: SendShopFileRequest, authorization: str = Header(...)):
    """Generate and email Shop File."""
    user_id = get_user_id(authorization)
    start_date, end_date = get_iso_week_dates(body.year, body.week)

    visits = (
        supabase_admin.table("vendor_visits")
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "Complete")
        .gte("visit_date", start_date)
        .lte("visit_date", end_date)
        .order("visit_date")
        .order("visit_time")
        .execute()
    )

    if not visits.data:
        return {"success": False, "data": None, "error": "No complete visits for this week"}

    profile = supabase_admin.table("profiles").select("*").eq("id", user_id).single().execute()
    first_name = (profile.data.get("full_name") or "Shopper").split()[0]

    output, filename = generate_shop_file(visits.data, first_name)
    file_bytes = output.read()

    try:
        result = resend.Emails.send({
            "from": "ShopRight <onboarding@resend.dev>",
            "to": [body.recipient_email],
            "subject": filename.replace(".xlsx", ""),
            "html": f"<p>Weekly Shop File attached: {filename}</p>",
            "attachments": [{"filename": filename, "content": base64.b64encode(file_bytes).decode()}],
        })
        return {"success": True, "data": {"id": result.get("id"), "filename": filename}, "error": None}
    except Exception as e:
        return {"success": False, "data": None, "error": f"Failed to send email: {str(e)}"}


class MileageEntry(BaseModel):
    date: str
    miles: float


class GenerateInvoiceRequest(BaseModel):
    year: int
    month: int
    mileage_entries: List[MileageEntry]


@router.post("/generate/invoice")
def generate_invoice_endpoint(body: GenerateInvoiceRequest, authorization: str = Header(...)):
    """Generate and return Invoice .xlsx."""
    user_id = get_user_id(authorization)

    start_date = f"{body.year}-{body.month:02d}-01"
    if body.month == 12:
        end_date = f"{body.year + 1}-01-01"
    else:
        end_date = f"{body.year}-{body.month + 1:02d}-01"

    visits = (
        supabase_admin.table("vendor_visits")
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "Complete")
        .gte("visit_date", start_date)
        .lt("visit_date", end_date)
        .order("visit_date")
        .order("visit_time")
        .execute()
    )

    if not visits.data:
        return {"success": False, "data": None, "error": "No complete visits for this month"}

    profile = supabase_admin.table("profiles").select("*").eq("id", user_id).single().execute()
    mileage_dicts = [{"date": e.date, "miles": e.miles} for e in body.mileage_entries]

    output, invoice_id = generate_invoice(visits.data, mileage_dicts, profile.data, body.year, body.month)

    month_names = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December']
    filename = f"Invoice {month_names[body.month]} {body.year}.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


class SendInvoiceRequest(BaseModel):
    year: int
    month: int
    mileage_entries: List[MileageEntry]
    recipient_email: str


@router.post("/send/invoice")
def send_invoice(body: SendInvoiceRequest, authorization: str = Header(...)):
    """Generate and email Invoice."""
    user_id = get_user_id(authorization)

    start_date = f"{body.year}-{body.month:02d}-01"
    if body.month == 12:
        end_date = f"{body.year + 1}-01-01"
    else:
        end_date = f"{body.year}-{body.month + 1:02d}-01"

    visits = (
        supabase_admin.table("vendor_visits")
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "Complete")
        .gte("visit_date", start_date)
        .lt("visit_date", end_date)
        .order("visit_date")
        .order("visit_time")
        .execute()
    )

    if not visits.data:
        return {"success": False, "data": None, "error": "No complete visits for this month"}

    profile = supabase_admin.table("profiles").select("*").eq("id", user_id).single().execute()
    mileage_dicts = [{"date": e.date, "miles": e.miles} for e in body.mileage_entries]

    output, invoice_id = generate_invoice(visits.data, mileage_dicts, profile.data, body.year, body.month)
    file_bytes = output.read()

    month_names = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December']
    filename = f"Invoice {month_names[body.month]} {body.year}.xlsx"

    try:
        result = resend.Emails.send({
            "from": "ShopRight <onboarding@resend.dev>",
            "to": [body.recipient_email],
            "subject": filename.replace(".xlsx", ""),
            "html": f"<p>Monthly Invoice attached: {filename}</p>",
            "attachments": [{"filename": filename, "content": base64.b64encode(file_bytes).decode()}],
        })
        return {"success": True, "data": {"id": result.get("id"), "filename": filename}, "error": None}
    except Exception as e:
        return {"success": False, "data": None, "error": f"Failed to send email: {str(e)}"}
