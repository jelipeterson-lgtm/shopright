from fastapi import APIRouter, Header
from pydantic import BaseModel
from typing import Optional
from db import supabase_admin
from routers.auth import get_user_id
import anthropic
import json

router = APIRouter(prefix="/review", tags=["review"])

REVIEW_PROMPT = """You are a Smart Circle International field manager reviewing a secret shopper's visit report. Your job is to flag anything that would confuse or concern someone reading this report cold — contradictions, vague descriptions, missing context, or statements that don't make sense.

Return ONLY questions — no corrections, no rewrites, no suggestions. Each question should reference the specific field and ask what's unclear.

If everything looks clear and professional, return an empty list.

Visit details:
- Retailer: {retailer_name}
- Store #: {store_number}
- Program: {program}
- Reps Present: {reps_present}
- Rep Count: {rep_count}

{field_notes}

Return your response as a JSON array of objects, each with "field" (the field name) and "question" (your question). Example:
[{{"field": "Visit Recap", "question": "You mention the rep was helpful but marked greeting as Fail — can you clarify?"}}]

If no issues found, return: []"""


class ReviewRequest(BaseModel):
    visit_id: str


@router.post("")
def review_visit(body: ReviewRequest, authorization: str = Header(...)):
    user_id = get_user_id(authorization)

    # Get user's API key
    profile = supabase_admin.table("profiles").select("anthropic_api_key, ai_review_enabled").eq("id", user_id).single().execute()

    if not profile.data or not profile.data.get("ai_review_enabled") or not profile.data.get("anthropic_api_key"):
        return {"success": True, "data": {"flags": [], "skipped": True, "reason": "no_key"}, "error": None}

    # Get the visit
    visit = supabase_admin.table("vendor_visits").select("*").eq("id", body.visit_id).eq("user_id", user_id).single().execute()
    if not visit.data:
        return {"success": False, "data": None, "error": "Visit not found"}

    v = visit.data

    # Build field notes for the prompt
    field_notes = []

    # Comment fields (only include non-empty ones)
    comment_fields = [
        ("Rep Names", v.get("rep_names")),
        ("Rep Description", v.get("rep_description")),
        ("Rep Count Reason", v.get("rep_count_reason")),
        ("Engaging Comment", v.get("eval_engaging_comment")),
        ("Greeting Comment", v.get("eval_greeting_comment")),
        ("One No Comment", v.get("eval_one_no_comment")),
        ("Pushy Comment", v.get("eval_pushy_comment")),
        ("Clogging Comment", v.get("eval_clogging_comment")),
        ("Leaning Comment", v.get("eval_leaning_comment")),
        ("Food/Drink Comment", v.get("eval_food_drink_comment")),
        ("Dress Code Comment", v.get("eval_dress_code_comment")),
        ("Name Badge Comment", v.get("eval_name_badge_comment")),
        ("Badge Location Comment", v.get("eval_badge_location_comment")),
        ("Badge Where", v.get("eval_badge_where")),
        ("Other Area Comment", v.get("eval_other_area_comment")),
        ("Other Store Areas Comment", v.get("eval_other_store_areas_comment")),
        ("Soft Selling Comment", v.get("eval_soft_selling_comment")),
        ("Visit Recap", v.get("visit_recap")),
    ]

    notes_text = ""
    for name, value in comment_fields:
        if value and value.strip():
            notes_text += f"- {name}: {value.strip()}\n"

    if not notes_text:
        notes_text = "No comments or notes entered."

    prompt = REVIEW_PROMPT.format(
        retailer_name=v.get("retailer_name", ""),
        store_number=v.get("store_number", ""),
        program=v.get("program", ""),
        reps_present=v.get("reps_present", ""),
        rep_count=v.get("rep_count", ""),
        field_notes=notes_text,
    )

    try:
        client = anthropic.Anthropic(api_key=profile.data["anthropic_api_key"])
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}],
        )

        # Parse the response
        response_text = response.content[0].text.strip()

        # Try to extract JSON from the response
        try:
            # Handle case where response might have markdown code blocks
            if "```" in response_text:
                json_start = response_text.index("[")
                json_end = response_text.rindex("]") + 1
                response_text = response_text[json_start:json_end]
            flags = json.loads(response_text)
            if not isinstance(flags, list):
                flags = []
        except (json.JSONDecodeError, ValueError):
            flags = []

        return {"success": True, "data": {"flags": flags, "skipped": False}, "error": None}

    except anthropic.AuthenticationError:
        return {"success": True, "data": {"flags": [], "skipped": True, "reason": "invalid_key"}, "error": None}
    except Exception as e:
        return {"success": True, "data": {"flags": [], "skipped": True, "reason": "api_error"}, "error": None}
