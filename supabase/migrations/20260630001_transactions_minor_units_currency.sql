-- 20260630001_transactions_minor_units_currency.sql
-- Rentivo AI-core fintech ledger (public.transactions) — multi-currency hardening.
--
-- WHY: the ledger receives TWO real currencies:
--   • EUR rental payments  — create-payment-intent → destination-charge PaymentIntent
--   • HUF AI-service charges — services/ai_agent/router_engine → Checkout Session
-- The original `amount_huf integer` column + a MISSING `currency` column could not
-- represent EUR faithfully (it stored int(amount/100), truncating the cents) and
-- mislabeled the currency. This migration moves the ledger to lossless Stripe MINOR
-- units (cents / fillér) + an explicit currency, relaxes application_fee_amount to
-- NULL for platform-direct charges (the HUF Checkout Sessions carry no Connect
-- application fee), and finally enables RLS (the table was created without it).
--
-- Safe to re-run: every step is guarded.

DO $$
BEGIN
  -- Guard: table must exist.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'transactions'
  ) THEN
    RAISE NOTICE 'public.transactions missing — skipping migration.';
    RETURN;
  END IF;

  -- 1) currency column (platform default EUR; the AI-service path writes 'huf').
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'currency'
  ) THEN
    ALTER TABLE public.transactions ADD COLUMN currency text NOT NULL DEFAULT 'eur';
  END IF;

  -- 2) amount_huf (HUF-named, major-unit) → amount_minor (Stripe MINOR units).
  --    The pre-existing rows stored int(amount/100); recover the native minor-unit
  --    amount with ×100. Runs EXACTLY ONCE, inside the rename branch.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'amount_huf'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'amount_minor'
  ) THEN
    ALTER TABLE public.transactions RENAME COLUMN amount_huf TO amount_minor;
    UPDATE public.transactions SET amount_minor = amount_minor * 100;
  END IF;

  -- 3) application_fee_amount NULLABLE — platform-direct (HUF service) charges have
  --    no Connect application fee. NULL means "not applicable", never a silent 0.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions'
      AND column_name = 'application_fee_amount' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.transactions ALTER COLUMN application_fee_amount DROP NOT NULL;
  END IF;
END $$;

-- 4) RLS — the ledger was created WITHOUT row-level security. It is written only by
--    the service role (which bypasses RLS) and is never read by anon/authenticated
--    clients. Enable RLS with a deny-all policy so no client key can ever touch it.
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'transactions' AND policyname = 'Service role only'
  ) THEN
    CREATE POLICY "Service role only" ON public.transactions
      FOR ALL USING (false) WITH CHECK (false); -- only the service role (RLS-exempt) writes
  END IF;
END $$;

COMMENT ON COLUMN public.transactions.amount_minor IS
  'Gross charge in Stripe MINOR units (EUR cents / HUF fillér). Pair with currency. Never divide on write.';
COMMENT ON COLUMN public.transactions.currency IS
  'ISO 4217 currency of the charge, lowercase (e.g. eur, huf). Source of truth for the amount_minor scale.';
COMMENT ON COLUMN public.transactions.application_fee_amount IS
  'Connect platform commission in MINOR units, read from Stripe. NULL for platform-direct charges (no application fee). Never a silent 0.';
