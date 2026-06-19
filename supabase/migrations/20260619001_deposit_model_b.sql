-- ════════════════════════════════════════════════════════════════════════════
-- Deposit Model B — vault the renter's card at booking (SetupIntent), charge
-- off_session on assessed damage up to the deposit cap.
-- ════════════════════════════════════════════════════════════════════════════
--
-- Additive + idempotent. Adds:
--   rentivo_users.stripe_customer_id     — PLATFORM Stripe Customer for the renter
--                                          (needed for later off_session charges)
--   rentivo_bookings.deposit_setup_intent_id    — Stripe SetupIntent that vaults the card
--   rentivo_bookings.deposit_payment_method_id  — vaulted PaymentMethod (set on si.succeeded)
--   rentivo_bookings.deposit_status      — none|authorized|charged|charge_failed|released
--   rentivo_bookings.deposit_charged_amount      — EUR amount actually charged on damage
--
-- No data backfill, no column drops. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

-- Renter platform Stripe Customer id
ALTER TABLE public.rentivo_users
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Deposit (Model B) columns on bookings
ALTER TABLE public.rentivo_bookings
  ADD COLUMN IF NOT EXISTS deposit_setup_intent_id text;

ALTER TABLE public.rentivo_bookings
  ADD COLUMN IF NOT EXISTS deposit_payment_method_id text;

ALTER TABLE public.rentivo_bookings
  ADD COLUMN IF NOT EXISTS deposit_status text NOT NULL DEFAULT 'none';

ALTER TABLE public.rentivo_bookings
  ADD COLUMN IF NOT EXISTS deposit_charged_amount numeric NOT NULL DEFAULT 0;

-- Constrain deposit_status to the known state machine (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rentivo_bookings_deposit_status_check'
  ) THEN
    ALTER TABLE public.rentivo_bookings
      ADD CONSTRAINT rentivo_bookings_deposit_status_check
      CHECK (deposit_status IN ('none','authorized','charged','charge_failed','released'));
  END IF;
END $$;

COMMENT ON COLUMN public.rentivo_users.stripe_customer_id IS
  'Deposit Model B: PLATFORM-account Stripe Customer for the renter. Created on
   first SetupIntent; reused for off_session deposit PaymentIntents.';
COMMENT ON COLUMN public.rentivo_bookings.deposit_status IS
  'Deposit Model B state: none | authorized (card vaulted via SetupIntent) |
   charged | charge_failed | released.';
