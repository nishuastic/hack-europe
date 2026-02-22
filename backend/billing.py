"""Billing module — Paid.ai usage tracking + Stripe payments + local credit gating."""

import logging

import stripe
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from backend.config import settings
from backend.models import UsageEvent, UsageEventType, UserCredits

logger = logging.getLogger(__name__)

# ─── Paid.ai client ──────────────────────────────────────────────────
try:
    from paid import Paid

    paid_client: Paid | None = Paid(token=settings.paid_api_key) if settings.paid_api_key else None
except Exception:
    paid_client = None
    logger.warning("Paid.ai SDK not available — billing signals will be skipped")

# ─── Stripe config ───────────────────────────────────────────────────
stripe.api_key = settings.stripe_api_key

# ─── Stick Credits — cost per action ─────────────────────────────────
# Currency: stick_credits (SC). Users buy packs/tiers in EUR, spend SC on actions.
CREDIT_COSTS: dict[UsageEventType, int] = {
    UsageEventType.ENRICHMENT: 5,    # 5 SC — deep web research per company
    UsageEventType.MATCHING: 2,      # 2 SC — AI product-to-lead matching
    UsageEventType.PITCH_DECK: 10,   # 10 SC — 7-slide personalized deck
    UsageEventType.EMAIL: 1,         # 1 SC — personalized outreach email
    UsageEventType.LINKEDIN_OUTREACH: 0,  # Free — warm intro outreach plan
    UsageEventType.ICP_RESEARCH: 3,      # 3 SC per customer researched for ICP
}

# ─── Tier plans (monthly subscriptions) ──────────────────────────────
TIER_PLANS: dict[str, dict[str, str | int]] = {
    "starter": {
        "label": "Stick Starter",
        "price_id": "price_1T3NMyLz0lFEuRtxYy50V3cd",
        "credits": 500,
        "eur_display": "€29/mo",
        "per_credit": "€0.058",
    },
    "growth": {
        "label": "Stick Growth",
        "price_id": "price_1T3NMzLz0lFEuRtxGSokBEtE",
        "credits": 2000,
        "eur_display": "€89/mo",
        "per_credit": "€0.045",
    },
    "scale": {
        "label": "Stick Scale",
        "price_id": "price_1T3NN0Lz0lFEuRtxyQJmvFcm",
        "credits": 10000,
        "eur_display": "€349/mo",
        "per_credit": "€0.035",
    },
}

# ─── PAYG credit packs (one-time) ────────────────────────────────────
PAYG_PACKS: dict[str, dict[str, str | int]] = {
    "100": {
        "label": "100 Stick Credits",
        "price_id": "price_1T3NN0Lz0lFEuRtxCRPCPrFA",
        "credits": 100,
        "eur_display": "€9.99",
        "per_credit": "€0.100",
    },
    "500": {
        "label": "500 Stick Credits",
        "price_id": "price_1T3NN1Lz0lFEuRtxBxthtqU0",
        "credits": 500,
        "eur_display": "€39.99",
        "per_credit": "€0.080",
    },
    "2000": {
        "label": "2,000 Stick Credits",
        "price_id": "price_1T3NN1Lz0lFEuRtxHbKHWIUg",
        "credits": 2000,
        "eur_display": "€129.99",
        "per_credit": "€0.065",
    },
    "5000": {
        "label": "5,000 Stick Credits",
        "price_id": "price_1T3NN2Lz0lFEuRtxAGJcAHCP",
        "credits": 5000,
        "eur_display": "€249.99",
        "per_credit": "€0.050",
    },
}


async def ensure_customer(user_id: int, email: str, session: AsyncSession) -> UserCredits:
    """Get or create UserCredits row, creating Paid.ai + Stripe customers if needed."""
    result = await session.execute(select(UserCredits).where(UserCredits.user_id == user_id))
    credits = result.scalar_one_or_none()

    if credits is None:
        credits = UserCredits(user_id=user_id, credits_remaining=100)
        session.add(credits)
        await session.commit()
        await session.refresh(credits)

    # Lazily create Stripe customer
    if not credits.stripe_customer_id and settings.stripe_api_key:
        try:
            customer = stripe.Customer.create(email=email, metadata={"user_id": str(user_id)})
            credits.stripe_customer_id = customer.id
            session.add(credits)
            await session.commit()
            await session.refresh(credits)
        except Exception:
            logger.exception("Failed to create Stripe customer")

    # Lazily create Paid.ai customer
    if not credits.paid_customer_id and paid_client:
        try:
            paid_customer = paid_client.customers.create_customer(
                name=email,
                external_id=str(user_id),
            )
            credits.paid_customer_id = paid_customer.id
            session.add(credits)
            await session.commit()
            await session.refresh(credits)
        except Exception as exc:
            if "DUPLICATE_EXTERNAL_ID" in str(exc):
                logger.info("Paid.ai customer exists for user %d, fetching", user_id)
                try:
                    existing = paid_client.customers.list_customers(
                        external_id=str(user_id),
                    )
                    if existing and existing.data:
                        credits.paid_customer_id = existing.data[0].id
                        session.add(credits)
                        await session.commit()
                        await session.refresh(credits)
                except Exception:
                    logger.exception("Failed to fetch existing Paid.ai customer")
            else:
                logger.exception("Failed to create Paid.ai customer")

    return credits


async def check_credits(user_id: int, event_type: UsageEventType, session: AsyncSession) -> bool:
    """Check if the user has enough credits for the action."""
    cost = CREDIT_COSTS[event_type]
    result = await session.execute(select(UserCredits).where(UserCredits.user_id == user_id))
    credits = result.scalar_one_or_none()
    if credits is None:
        return False
    return credits.credits_remaining >= cost


async def deduct_credits(
    user_id: int,
    event_type: UsageEventType,
    session: AsyncSession,
    metadata: dict | None = None,
) -> int:
    """Deduct credits and record usage event. Returns remaining credits."""
    cost = CREDIT_COSTS[event_type]
    result = await session.execute(select(UserCredits).where(UserCredits.user_id == user_id))
    credits = result.scalar_one_or_none()
    if credits is None or credits.credits_remaining < cost:
        raise ValueError("Insufficient credits")

    credits.credits_remaining -= cost
    session.add(credits)

    event = UsageEvent(user_id=user_id, event_type=event_type, credits_used=cost)
    session.add(event)
    await session.commit()
    await session.refresh(credits)

    # Emit Paid.ai signal (best-effort, non-blocking)
    _emit_signal(event_type, credits, metadata or {})

    return credits.credits_remaining


def _emit_signal(event_type: UsageEventType, credits: UserCredits, metadata: dict) -> None:
    """Send a usage signal to Paid.ai for analytics + invoicing."""
    if not paid_client:
        return

    event_names = {
        UsageEventType.ENRICHMENT: "enrich_lead",
        UsageEventType.MATCHING: "matching",
        UsageEventType.PITCH_DECK: "pitch_deck_generation",
        UsageEventType.EMAIL: "email_generation",
        UsageEventType.LINKEDIN_OUTREACH: "linkedin_outreach",
    }

    try:
        paid_client.signals.create_signals(
            signals=[
                {
                    "event_name": event_names[event_type],
                    "customer": {"external_customer_id": str(credits.user_id)},
                    "attribution": {"external_product_id": settings.paid_product_external_id},
                    "data": metadata,
                }
            ],
        )
    except Exception:
        logger.exception("Failed to emit Paid.ai signal for %s", event_type)


async def create_tier_checkout(user_id: int, tier: str, session: AsyncSession) -> str:
    """Create a Stripe Checkout session for a tier subscription. Returns checkout URL."""
    if tier not in TIER_PLANS:
        raise ValueError(f"Unknown tier: {tier}")

    plan = TIER_PLANS[tier]
    result = await session.execute(select(UserCredits).where(UserCredits.user_id == user_id))
    credits = result.scalar_one_or_none()
    customer_id = credits.stripe_customer_id if credits else None

    checkout = stripe.checkout.Session.create(
        mode="subscription",
        customer=customer_id or "",
        line_items=[{"price": str(plan["price_id"]), "quantity": 1}],
        metadata={
            "user_id": str(user_id),
            "type": "tier",
            "tier": tier,
            "credits": str(plan["credits"]),
        },
        success_url="http://localhost:3000/billing?success=true",
        cancel_url="http://localhost:3000/billing?canceled=true",
    )
    return checkout.url or ""


async def create_payg_checkout(user_id: int, pack: str, session: AsyncSession) -> str:
    """Create a Stripe Checkout session for a one-time credit pack. Returns checkout URL."""
    if pack not in PAYG_PACKS:
        raise ValueError(f"Unknown pack: {pack}")

    pack_info = PAYG_PACKS[pack]
    result = await session.execute(select(UserCredits).where(UserCredits.user_id == user_id))
    credits = result.scalar_one_or_none()
    customer_id = credits.stripe_customer_id if credits else None

    checkout = stripe.checkout.Session.create(
        mode="payment",
        customer=customer_id or "",
        line_items=[{"price": str(pack_info["price_id"]), "quantity": 1}],
        metadata={
            "user_id": str(user_id),
            "type": "payg",
            "pack": pack,
            "credits": str(pack_info["credits"]),
        },
        success_url="http://localhost:3000/billing?success=true",
        cancel_url="http://localhost:3000/billing?canceled=true",
    )
    return checkout.url or ""


async def handle_stripe_webhook(payload: bytes, sig_header: str, session: AsyncSession) -> dict:
    """Process Stripe webhook events. Returns status dict."""
    event = stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)

    # ── One-time PAYG purchase completed ─────────────────────────────
    if event["type"] == "checkout.session.completed":
        data = event["data"]["object"]
        meta = data.get("metadata", {})
        if meta.get("type") == "payg":
            user_id = int(meta["user_id"])
            credits_to_add = int(meta["credits"])
            await _add_credits(user_id, credits_to_add, session)

        # Handle tier subscription checkout completion
        if meta.get("type") == "tier":
            user_id = int(meta["user_id"])
            credits_to_add = int(meta["credits"])
            tier = meta.get("tier")
            await _add_credits(user_id, credits_to_add, session)
            await _update_subscription(user_id, data.get("subscription"), "active", tier, session)

    # ── Subscription updated ─────────────────────────────────────────
    if event["type"] == "customer.subscription.updated":
        sub = event["data"]["object"]
        meta = sub.get("metadata", {})
        if meta.get("type") == "tier" and "user_id" in meta:
            user_id = int(meta["user_id"])
            status = sub.get("status")
            tier = meta.get("tier")
            await _update_subscription(user_id, sub.id, status, tier, session)

    # ── Subscription canceled ─────────────────────────────────────────
    if event["type"] == "customer.subscription.deleted":
        sub = event["data"]["object"]
        meta = sub.get("metadata", {})
        if meta.get("type") == "tier" and "user_id" in meta:
            user_id = int(meta["user_id"])
            await _update_subscription(user_id, None, "canceled", None, session)

    # ── Tier subscription: credits on each invoice paid ──────────────
    if event["type"] == "invoice.paid":
        invoice = event["data"]["object"]
        sub_id = invoice.get("subscription")
        if sub_id:
            sub = stripe.Subscription.retrieve(sub_id)
            meta = sub.get("metadata", {})
            if meta.get("type") == "tier" and "user_id" in meta:
                user_id = int(meta["user_id"])
                credits_to_add = int(meta["credits"])
                await _add_credits(user_id, credits_to_add, session)

    return {"status": "ok"}


async def _update_subscription(
    user_id: int,
    subscription_id: str | None,
    status: str | None,
    tier: str | None,
    session: AsyncSession,
) -> None:
    """Update user's subscription info."""
    result = await session.execute(select(UserCredits).where(UserCredits.user_id == user_id))
    user_credits = result.scalar_one_or_none()
    if user_credits:
        user_credits.stripe_subscription_id = subscription_id
        user_credits.subscription_status = status
        user_credits.active_tier = tier
        session.add(user_credits)
        await session.commit()
        logger.info("Updated subscription for user %d: tier=%s, status=%s", user_id, tier, status)


async def _add_credits(user_id: int, amount: int, session: AsyncSession) -> None:
    """Add credits to a user's balance."""
    result = await session.execute(select(UserCredits).where(UserCredits.user_id == user_id))
    user_credits = result.scalar_one_or_none()
    if user_credits:
        user_credits.credits_remaining += amount
        session.add(user_credits)
        await session.commit()
        logger.info("Added %d SC to user %d (balance: %d)", amount, user_id, user_credits.credits_remaining)
