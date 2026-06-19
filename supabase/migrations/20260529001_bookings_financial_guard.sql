-- ════════════════════════════════════════════════════════════════════════════
-- B2 — rentivo_bookings: financial / deposit column write-guard  (CORRECTED)
-- ════════════════════════════════════════════════════════════════════════════
-- Additive + idempotent. Safe to re-run. No DROP that breaks a legit flow.
--
-- Threat: the "Booking parties update status" UPDATE policy has an EMPTY WITH CHECK
-- and `authenticated` held a table-wide UPDATE grant, so a traveler could PATCH
-- their own booking directly (total_amount -> 1 then create-payment-intent charges
-- EUR 1; payment_status='paid'; deposit_status='released'; etc.).
--
-- CORRECTION vs the original draft of this file:
--   * `status` is NO LONGER locked. operators/hosts/consumers legitimately set it
--     via lib/api/bookings.ts -> updateBookingStatus (confirm / cancel / active /
--     completed). Locking it (the original draft did) broke those flows.
--   * Added the Deposit Model B columns + stripe_charge_id the original draft missed.
--
-- Two layers:
--   (1) BEFORE UPDATE trigger: for a non-service_role session (auth.uid() NOT NULL)
--       reject any *change* (IS DISTINCT FROM) to a money/deposit/state column.
--       service_role (webhooks/edge) + superuser (migrations) bypass via NULL uid.
--   (2) Column-level privilege: a plain column REVOKE is a no-op while a table-level
--       UPDATE grant exists, so we REVOKE the table grant and re-GRANT UPDATE on
--       every column EXCEPT the protected set (list built from the catalog).
--
-- Verified legit authenticated writes that STAY allowed: status, updated_at,
--   consumer_signature, operator_signature, contract_signed_at, operator_signature_data,
--   operator_signed_at, guest_signature, guest_signed_at, contract_status, and all
--   logistical / damage columns.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rentivo_bookings_guard_financial_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;  -- service_role (webhook/edge) + superuser (migrations) bypass
  END IF;

  IF NEW.total_amount                 IS DISTINCT FROM OLD.total_amount
     OR NEW.subtotal                  IS DISTINCT FROM OLD.subtotal
     OR NEW.price_per_day             IS DISTINCT FROM OLD.price_per_day
     OR NEW.platform_fee              IS DISTINCT FROM OLD.platform_fee
     OR NEW.deposit_amount            IS DISTINCT FROM OLD.deposit_amount
     OR NEW.currency                  IS DISTINCT FROM OLD.currency
     OR NEW.payment_status            IS DISTINCT FROM OLD.payment_status
     OR NEW.payment_intent_id         IS DISTINCT FROM OLD.payment_intent_id
     OR NEW.paid_at                   IS DISTINCT FROM OLD.paid_at
     OR NEW.deposit_status            IS DISTINCT FROM OLD.deposit_status
     OR NEW.deposit_charged_amount    IS DISTINCT FROM OLD.deposit_charged_amount
     OR NEW.deposit_setup_intent_id   IS DISTINCT FROM OLD.deposit_setup_intent_id
     OR NEW.deposit_payment_method_id IS DISTINCT FROM OLD.deposit_payment_method_id
     OR NEW.stripe_charge_id          IS DISTINCT FROM OLD.stripe_charge_id
  THEN
    RAISE EXCEPTION
      'rentivo_bookings: financial/deposit columns are server-only (service_role). User % attempted a forbidden update.', auth.uid()
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

-- (2) Column-level UPDATE: grant every column EXCEPT the protected money/deposit set.
DO $$
DECLARE cols text;
BEGIN
  REVOKE UPDATE ON public.rentivo_bookings FROM authenticated;
  SELECT string_agg(quote_ident(column_name), ', ')
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'rentivo_bookings'
    AND column_name NOT IN (
      'total_amount','subtotal','price_per_day','platform_fee','deposit_amount','currency',
      'payment_status','payment_intent_id','paid_at','deposit_status','deposit_charged_amount',
      'deposit_setup_intent_id','deposit_payment_method_id','stripe_charge_id'
    );
  EXECUTE format('GRANT UPDATE (%s) ON public.rentivo_bookings TO authenticated', cols);
END $$;

COMMENT ON FUNCTION public.rentivo_bookings_guard_financial_columns() IS
  'B2 write-guard: blocks authenticated clients from CHANGING money/deposit/state columns on
   rentivo_bookings (status intentionally allowed for operator/host/consumer flows).
   service_role (webhooks/edge) + superuser bypass via NULL auth.uid().';

-- The guard is a trigger function: it fires as a trigger regardless of EXECUTE grants,
-- so it must NOT be directly /rpc/-callable. (Closes the anon/authenticated
-- security_definer_function_executable advisors.)
REVOKE EXECUTE ON FUNCTION public.rentivo_bookings_guard_financial_columns() FROM PUBLIC, anon, authenticated;
