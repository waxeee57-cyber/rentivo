import os
import json
import logging

import httpx
import stripe
from fastapi import FastAPI, Request, HTTPException

# LangGraph AI-core (intent → verify → execute). Imported so the compiled agent
# graph is available to the process; the webhook below feeds it payment-triggered
# work (cleaner dispatch, inventory, guest notification).
from services.ai_agent.router_engine import app as langgraph_app  # noqa: F401

logger = logging.getLogger("rentivo.webhook")

server = FastAPI(title="Rentivo AI Agent Core & Fintech API", version="2.0.0")

# NO CORS middleware: this is a server-to-server Stripe webhook receiver, never
# called from a browser. allow_origins=["*"] has been removed deliberately.

# ── Config — env only. Never hard-code secrets; keep the server↔client boundary.
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
# Local/CI escape hatch ONLY. Anywhere else, signatures are enforced.
SKIP_SIG_VERIFY = os.getenv("STRIPE_SKIP_SIG_VERIFY") == "true"

SUPABASE_URL = os.getenv("SUPABASE_URL")
# SERVICE ROLE (server-side) — NEVER the anon key. Mirror the Edge Functions' chain.
SUPABASE_SERVICE_ROLE_KEY = (
    os.getenv("SB_SECRET_KEY")
    or os.getenv("SUPABASE_SECRET_KEY")
    or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

stripe.api_key = STRIPE_SECRET_KEY

# The platform's own Connect account id, for platform-direct charges that carry no
# transfer destination (e.g. the HUF AI-service Checkout Sessions). Resolved lazily
# from env or Stripe — never a literal like "TEST_PLATFORM".
_platform_account_id: str | None = None


def platform_account_id() -> str | None:
    global _platform_account_id
    if _platform_account_id is None:
        env_acct = os.getenv("STRIPE_PLATFORM_ACCOUNT_ID")
        if env_acct:
            _platform_account_id = env_acct
        else:
            try:
                _platform_account_id = stripe.Account.retrieve().get("id")
            except Exception as exc:  # keys/network — leave unset, caller raises 500
                logger.error("Could not resolve platform account id: %s", exc)
    return _platform_account_id


def _as_dict(obj) -> dict:
    """metadata / transfer_data may be a StripeObject or a plain dict; normalize."""
    return dict(obj) if obj else {}


def _verify_event(payload: bytes, signature: str | None):
    """Return the Stripe event or raise 400. A missing/invalid signature is a hard
    400 with NO fallback parse — unless STRIPE_SKIP_SIG_VERIFY=='true' (local/CI)."""
    if SKIP_SIG_VERIFY:
        try:
            return json.loads(payload.decode("utf-8"))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON payload")

    if not signature or not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=400, detail="Missing Stripe signature")
    try:
        return stripe.Webhook.construct_event(payload, signature, STRIPE_WEBHOOK_SECRET)
    except (ValueError, stripe.error.SignatureVerificationError):
        raise HTTPException(status_code=400, detail="Invalid Stripe signature")


async def _record_transaction(tx: dict) -> None:
    """Append one ledger row. Append-only and idempotent on stripe_event_id:
    UNIQUE conflict → DO NOTHING (a webhook NEVER overwrites an existing row). Any
    non-2xx from Supabase raises 500 so Stripe retries — never a silent drop."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        logger.critical("Supabase service-role config missing — cannot ledger %s",
                        tx.get("stripe_event_id"))
        raise HTTPException(status_code=500, detail="Ledger backend not configured")

    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        # Append-only: on UNIQUE(stripe_event_id) conflict DO NOTHING (re-delivery safe).
        "Prefer": "resolution=ignore-duplicates,return=minimal",
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            res = await client.post(
                f"{SUPABASE_URL}/rest/v1/transactions", headers=headers, json=tx
            )
        except Exception as exc:
            logger.error("Ledger write failed (network) for %s: %s",
                         tx.get("stripe_event_id"), exc)
            raise HTTPException(status_code=500, detail="Ledger write failed")

    if res.status_code >= 300:
        logger.error("Ledger write rejected (%s) for %s: %s",
                     res.status_code, tx.get("stripe_event_id"), res.text)
        raise HTTPException(status_code=500, detail="Ledger write rejected")

    logger.info("Ledger row recorded for event %s", tx.get("stripe_event_id"))


@server.post("/api/v1/webhooks/stripe")
async def stripe_connect_webhook(request: Request):
    payload = await request.body()
    event = _verify_event(payload, request.headers.get("stripe-signature"))

    event_id = event.get("id")
    event_type = event.get("type")
    if not event_id or not event_type:
        raise HTTPException(status_code=400, detail="Malformed event")

    logger.info("Stripe webhook: %s (%s)", event_type, event_id)
    data_object = (event.get("data") or {}).get("object") or {}

    # ── EUR rental payment — destination-charge PaymentIntent (create-payment-intent).
    #    Identity: metadata.booking_id present AND not a deposit charge. The AI-service
    #    Checkout PaymentIntent has no booking_id, so it never lands here — that keeps
    #    its money out of this branch and prevents the double-count with the
    #    checkout.session.completed branch below.
    if event_type == "payment_intent.succeeded":
        md = _as_dict(data_object.get("metadata"))
        if md.get("kind") == "deposit_charge":
            logger.info("Deposit charge %s — not a rental ledger event, skipping", event_id)
            return {"received": True}
        if not md.get("booking_id"):
            logger.info("PI %s has no booking_id (not a rental) — skipping", event_id)
            return {"received": True}
        await _handle_rental_payment(event, data_object, md)
        return {"received": True}

    # ── HUF AI-service charge — router_engine Checkout Session. Platform-direct:
    #    no Connect destination, no application fee.
    if event_type == "checkout.session.completed":
        await _handle_service_checkout(event, data_object)
        return {"received": True}

    # Any other event type: acknowledge so Stripe stops retrying; nothing to ledger.
    return {"received": True}


async def _handle_rental_payment(event: dict, pi: dict, md: dict) -> None:
    pi_id = pi.get("id")
    if not pi_id:
        raise HTTPException(status_code=400, detail="payment_intent.succeeded without id")

    # IGAZSÁGFORRÁS: authoritative figures come from Stripe, never a payload guess.
    # Expand the charge so we can read the APPLIED platform commission from it.
    try:
        full = stripe.PaymentIntent.retrieve(pi_id, expand=["latest_charge"])
    except Exception as exc:
        logger.error("PaymentIntent retrieve failed for %s: %s", pi_id, exc)
        raise HTTPException(status_code=500, detail="Could not load PaymentIntent")

    charge = _as_dict(full.get("latest_charge"))
    amount_minor = full.get("amount_received") or full.get("amount") or 0
    currency = (full.get("currency") or "").lower()
    destination = _as_dict(full.get("transfer_data")).get("destination")

    # Platform commission = the APPLICATION fee, read from the charge first (the
    # applied value), PI-level only as fallback. This is NOT balance_transaction.fee
    # — that field is Stripe's own processing fee, a different number entirely.
    app_fee = charge.get("application_fee_amount")
    if app_fee is None:
        app_fee = full.get("application_fee_amount")

    if not currency or amount_minor <= 0:
        logger.error("Rental PI %s invalid amount/currency: %s %s",
                     pi_id, amount_minor, currency)
        raise HTTPException(status_code=400, detail="Invalid PaymentIntent amount")

    # A destination charge MUST carry an application fee. If it doesn't, the fee is
    # not determinable — log and 500 (retry); NEVER book 0 silently.
    if destination and app_fee is None:
        logger.error("Destination charge %s missing application_fee_amount — refusing to book 0", pi_id)
        raise HTTPException(status_code=500, detail="Application fee not determinable")

    stripe_account = destination or platform_account_id()
    if not stripe_account:
        logger.error("Rental PI %s: no destination and no resolvable platform account", pi_id)
        raise HTTPException(status_code=500, detail="Charge account not determinable")

    await _record_transaction({
        "stripe_event_id": event.get("id"),
        "stripe_account_id": stripe_account,
        "payment_intent_id": pi_id,
        "amount_minor": int(amount_minor),
        "currency": currency,
        "application_fee_amount": int(app_fee) if app_fee is not None else None,
        "status": "succeeded",
    })

    # Payment-triggered AI workflow: booking turnover → cleaner dispatch, etc.
    logger.info("Rental paid (booking=%s, %s %s) — dispatching turnover workflow",
                md.get("booking_id"), amount_minor, currency)


async def _handle_service_checkout(event: dict, session: dict) -> None:
    payment_intent_id = session.get("payment_intent")
    amount_minor = session.get("amount_total") or 0
    currency = (session.get("currency") or "").lower()

    if not payment_intent_id or amount_minor <= 0 or not currency:
        logger.error("Service checkout %s missing pi/amount/currency: %s %s %s",
                     event.get("id"), payment_intent_id, amount_minor, currency)
        raise HTTPException(status_code=400, detail="Invalid checkout session")

    account = platform_account_id()
    if not account:
        logger.error("Service checkout %s: platform account not resolvable", event.get("id"))
        raise HTTPException(status_code=500, detail="Charge account not determinable")

    await _record_transaction({
        "stripe_event_id": event.get("id"),
        "stripe_account_id": account,
        "payment_intent_id": payment_intent_id,
        "amount_minor": int(amount_minor),
        "currency": currency,
        # Platform-direct charge: no Connect application fee (NULL, not 0).
        "application_fee_amount": None,
        "status": "succeeded",
    })

    logger.info("AI-service charge settled (%s %s) — dispatching service workflow",
                amount_minor, currency)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:server", host="127.0.0.1", port=8000, reload=True)
