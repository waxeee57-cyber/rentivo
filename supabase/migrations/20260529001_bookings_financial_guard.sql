-- ════════════════════════════════════════════════════════════════════════════
-- B2 — rentivo_bookings: financial / state column write-guard
-- ════════════════════════════════════════════════════════════════════════════
--
-- Problem: 040_bookings.sql defines a USING-only UPDATE policy
--   ("Booking parties update status") with NO column restriction. RLS USING/WITH
--   CHECK cannot reference the OLD row, so it cannot express "you may UPDATE this
--   row but you may not change THESE columns". Result: a traveler (or operator)
--   could self-confirm by writing payment_status='paid', status='confirmed', or
--   alter total_amount directly from the authenticated client.
--
-- Why a BEFORE UPDATE trigger (and not column-level REVOKE/GRANT):
--   1. Travelers AND operators share the same Postgres role (`authenticated`);
--      column privileges cannot distinguish "untrusted client" from "service".
--      A trigger can: it keys off auth.uid() (NULL for service_role / superuser).
--   2. A trigger compares OLD vs NEW (IS DISTINCT FROM), so it only blocks an
--      actual *change* to a protected column. A full-row PostgREST update that
--      merely re-sends unchanged values still succeeds — column REVOKE would
--      reject it outright.
--   3. The webhook / Edge Functions use the service-role key (auth.uid() = NULL)
--      and keep full write access; DB migrations run as superuser (auth.uid()
--      = NULL) and are unaffected.
--
-- Legit client writes are unaffected: lib/api/bookings.ts only patches logistical
-- columns (pickup_location, pickup_time, return_time, notes), none of which are
-- guarded here.
--
-- Locked columns (only service_role / superuser may change them):
--   status, payment_status, total_amount, subtotal, platform_fee,
--   price_per_day, deposit_amount, currency, payment_intent_id, paid_at
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rentivo_bookings_guard_financial_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role (webhook + Edge Functions) and the postgres superuser (migrations,
  -- admin tasks) operate without an end-user JWT, so auth.uid() is NULL → bypass.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Authenticated end-user request (traveler or operator):
  -- reject any change to money/state columns.
  IF NEW.status            IS DISTINCT FROM OLD.status
     OR NEW.payment_status    IS DISTINCT FROM OLD.payment_status
     OR NEW.total_amount      IS DISTINCT FROM OLD.total_amount
     OR NEW.subtotal          IS DISTINCT FROM OLD.subtotal
     OR NEW.platform_fee      IS DISTINCT FROM OLD.platform_fee
     OR NEW.price_per_day     IS DISTINCT FROM OLD.price_per_day
     OR NEW.deposit_amount    IS DISTINCT FROM OLD.deposit_amount
     OR NEW.currency          IS DISTINCT FROM OLD.currency
     OR NEW.payment_intent_id IS DISTINCT FROM OLD.payment_intent_id
     OR NEW.paid_at           IS DISTINCT FROM OLD.paid_at
  THEN
    RAISE EXCEPTION
      'rentivo_bookings: financial/state columns can only be changed by the server (service_role). User % attempted a forbidden update.', auth.uid()
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rentivo_bookings_guard_financial ON public.rentivo_bookings;
CREATE TRIGGER rentivo_bookings_guard_financial
  BEFORE UPDATE ON public.rentivo_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.rentivo_bookings_guard_financial_columns();

COMMENT ON FUNCTION public.rentivo_bookings_guard_financial_columns() IS
  'B2 write-guard: blocks authenticated clients (auth.uid() IS NOT NULL) from
   modifying money/state columns on rentivo_bookings. service_role (webhooks,
   Edge Functions) and superuser bypass via NULL auth.uid().';
