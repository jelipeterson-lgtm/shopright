from fastapi import APIRouter, Header, Request
from pydantic import BaseModel
from typing import Optional
from db import supabase_admin
from routers.auth import get_user_id
import stripe
import os

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

MONTHLY_PRICE_ID = "price_1TJIMBRsPFnm3irYLta8jhrl"
ANNUAL_PRICE_ID = "price_1TJIMBRsPFnm3irY4NJddmvd"
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/status")
def get_subscription_status(authorization: str = Header(...)):
    """Check user's subscription status."""
    user_id = get_user_id(authorization)

    profile = (
        supabase_admin.table("profiles")
        .select("is_free_account, stripe_customer_id, subscription_status, trial_ends_at, created_at")
        .eq("id", user_id)
        .single()
        .execute()
    )
    p = profile.data

    # Free accounts bypass everything
    if p.get("is_free_account"):
        return {"success": True, "data": {"access": True, "reason": "free_account"}, "error": None}

    # Active subscription
    if p.get("subscription_status") == "active":
        return {"success": True, "data": {"access": True, "reason": "subscribed"}, "error": None}

    # Check trial
    trial_end = p.get("trial_ends_at")
    if trial_end:
        from datetime import datetime
        try:
            end_dt = datetime.fromisoformat(trial_end.replace("Z", "+00:00"))
            if datetime.now(end_dt.tzinfo) < end_dt:
                return {"success": True, "data": {"access": True, "reason": "trial", "trial_ends_at": trial_end}, "error": None}
        except Exception:
            pass

    # No access
    return {
        "success": True,
        "data": {
            "access": False,
            "reason": "expired",
            "monthly_price": MONTHLY_PRICE_ID,
            "annual_price": ANNUAL_PRICE_ID,
        },
        "error": None,
    }


class CreateCheckoutRequest(BaseModel):
    price_id: str


@router.post("/checkout")
def create_checkout_session(body: CreateCheckoutRequest, authorization: str = Header(...)):
    """Create a Stripe Checkout session."""
    user_id = get_user_id(authorization)

    profile = (
        supabase_admin.table("profiles")
        .select("stripe_customer_id, report_email")
        .eq("id", user_id)
        .single()
        .execute()
    )

    customer_id = profile.data.get("stripe_customer_id")

    # Create Stripe customer if needed
    if not customer_id:
        customer = stripe.Customer.create(
            email=profile.data.get("report_email", ""),
            metadata={"user_id": user_id},
        )
        customer_id = customer.id
        supabase_admin.table("profiles").update(
            {"stripe_customer_id": customer_id}
        ).eq("id", user_id).execute()

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": body.price_id, "quantity": 1}],
        mode="subscription",
        success_url=f"{FRONTEND_URL}/app?payment=success",
        cancel_url=f"{FRONTEND_URL}/app?payment=cancelled",
    )

    return {"success": True, "data": {"url": session.url}, "error": None}


@router.post("/portal")
def create_portal_session(authorization: str = Header(...)):
    """Create a Stripe Customer Portal session for managing subscriptions."""
    user_id = get_user_id(authorization)

    profile = (
        supabase_admin.table("profiles")
        .select("stripe_customer_id")
        .eq("id", user_id)
        .single()
        .execute()
    )

    customer_id = profile.data.get("stripe_customer_id")
    if not customer_id:
        return {"success": False, "data": None, "error": "No subscription found"}

    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{FRONTEND_URL}/settings",
    )

    return {"success": True, "data": {"url": session.url}, "error": None}


class PromoCodeRequest(BaseModel):
    code: str


@router.post("/redeem")
def redeem_promo_code(body: PromoCodeRequest, authorization: str = Header(...)):
    """Redeem a promo code for free access."""
    user_id = get_user_id(authorization)

    # Simple promo code check — Eli sets valid codes in env
    valid_codes = [c.strip() for c in os.getenv("PROMO_CODES", "").split(",") if c.strip()]

    if body.code.strip().upper() in [c.upper() for c in valid_codes]:
        supabase_admin.table("profiles").update(
            {"is_free_account": True}
        ).eq("id", user_id).execute()
        return {"success": True, "data": "Free access granted", "error": None}

    return {"success": False, "data": None, "error": "Invalid promo code"}


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    try:
        if webhook_secret:
            event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
        else:
            import json
            event = json.loads(payload)
    except Exception:
        return {"error": "Invalid webhook"}

    event_type = event.get("type", "")
    data = event.get("data", {}).get("object", {})

    if event_type == "checkout.session.completed":
        customer_id = data.get("customer")
        if customer_id:
            supabase_admin.table("profiles").update(
                {"subscription_status": "active"}
            ).eq("stripe_customer_id", customer_id).execute()

    elif event_type == "customer.subscription.deleted":
        customer_id = data.get("customer")
        if customer_id:
            supabase_admin.table("profiles").update(
                {"subscription_status": "expired"}
            ).eq("stripe_customer_id", customer_id).execute()

    elif event_type == "customer.subscription.updated":
        customer_id = data.get("customer")
        status = data.get("status")
        if customer_id:
            supabase_admin.table("profiles").update(
                {"subscription_status": status}
            ).eq("stripe_customer_id", customer_id).execute()

    return {"received": True}
