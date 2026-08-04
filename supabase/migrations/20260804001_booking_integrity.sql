-- ═══════════════════════════════════════════════════════════════════════════
-- Booking integrity hardening — 2026-08-04
--
-- 1. Atomic promo redemption counter.
--    create-booking / create-payment-intent read `current_uses` and compared it
--    to `max_uses`, but NOTHING in the codebase ever incremented it. A
--    "first 100 customers" code was therefore a permanent, unlimited sitewide
--    discount. Grep evidence at the time of writing: zero UPDATE and zero RPC
--    touching current_uses.
--
-- 2. Double-booking backstop.
--    No overlap check and no DB constraint existed, so every paid booking left
--    the same vehicle sellable for the same dates, forever. The application-level
--    guard now lives in create-booking + create-payment-intent; this constraint
--    is the last line of defence for the remaining race window.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Promo redemption ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_promo_use(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.rentivo_promo_codes
     SET current_uses = COALESCE(current_uses, 0) + 1
   WHERE UPPER(code) = UPPER(p_code)
     AND (max_uses IS NULL OR COALESCE(current_uses, 0) < max_uses)
     AND (valid_from IS NULL OR valid_from <= NOW())
     AND (valid_until IS NULL OR valid_until >= NOW());
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_promo_use(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_promo_use(TEXT) TO service_role;

COMMENT ON FUNCTION public.increment_promo_use(TEXT) IS
  'Atomically redeem one use of a promo code. Returns false when the code is '
  'exhausted, not yet valid, or expired — callers must treat false as "promo not applied".';

-- ── 2. Double-booking backstop ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Applied only to money-bearing, non-cancelled DAILY bookings. Hourly rentals
-- share a calendar day by design (different time slots on the same vehicle), so
-- a date-range exclusion would reject legitimate hourly bookings.
--
-- Ranges are half-open [start, end) — matching the day-count math in
-- create-booking (Aug 10 -> Aug 12 is 2 rental days; the 12th is free). Same-day
-- rows are widened to one day so an empty range cannot slip through.
--
-- Wrapped: if legacy rows already overlap, the constraint cannot be created.
-- Fail loudly in the log rather than aborting the whole migration chain.
DO $$
BEGIN
  ALTER TABLE public.rentivo_bookings
    DROP CONSTRAINT IF EXISTS rentivo_bookings_no_overlap;

  ALTER TABLE public.rentivo_bookings
    ADD CONSTRAINT rentivo_bookings_no_overlap
    EXCLUDE USING gist (
      listing_id WITH =,
      daterange(start_date, GREATEST(end_date, start_date + 1), '[)') WITH &&
    )
    WHERE (
      status <> 'cancelled'
      AND payment_status IN ('paid', 'processing')
      AND rental_type IS DISTINCT FROM 'hourly'
    );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING
    'rentivo_bookings_no_overlap NOT created (%). Existing overlapping paid bookings must be resolved first: SELECT a.id, b.id FROM rentivo_bookings a JOIN rentivo_bookings b ON a.listing_id = b.listing_id AND a.id < b.id AND a.start_date < b.end_date AND b.start_date < a.end_date WHERE a.payment_status = ''paid'' AND b.payment_status = ''paid'' AND a.status <> ''cancelled'' AND b.status <> ''cancelled'';',
    SQLERRM;
END $$;

-- Supports the two availability-overlap probes in create-booking (the ranged
-- path already had an index; single-day manual blocks carry end_date IS NULL).
CREATE INDEX IF NOT EXISTS idx_availability_single_day
  ON public.rentivo_availability(listing_id, blocked_date)
  WHERE end_date IS NULL;

-- Supports the double-booking probe.
CREATE INDEX IF NOT EXISTS idx_bookings_listing_range
  ON public.rentivo_bookings(listing_id, start_date, end_date)
  WHERE status <> 'cancelled';

-- ── 3. Refund bookkeeping ──────────────────────────────────────────────────
-- The cancel-booking edge function issues a real Stripe refund; these columns
-- record what was returned and when. Before this, cancellation wrote nothing
-- beyond status='cancelled' and the refund shown in the UI never happened.
ALTER TABLE public.rentivo_bookings
  ADD COLUMN IF NOT EXISTS cancelled_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_amount  NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_id      TEXT;

COMMENT ON COLUMN public.rentivo_bookings.refund_amount IS
  'EUR actually refunded via Stripe by cancel-booking. 0 when the policy returned nothing.';

-- refund_amount / refund_id / cancelled_at are money columns: only the
-- service_role (edge functions) may write them. Mirrors the existing financial
-- guard on subtotal / platform_fee / total_amount.
DO $$
BEGIN
  EXECUTE 'REVOKE UPDATE (refund_amount, refund_id, cancelled_at) ON public.rentivo_bookings FROM authenticated, anon';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not revoke refund column grants: %', SQLERRM;
END $$;
