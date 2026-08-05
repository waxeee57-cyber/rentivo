-- Records which country a Stripe Connect account was opened for.
--
-- create-stripe-account-link hardcoded country: 'HU' for every operator. A
-- Connect account's country is IMMUTABLE, so a Spanish operator was handed a
-- Hungarian Express account, asked for a Hungarian tax ID and bank account,
-- and could never finish. The account id was cached, so every retry reopened
-- the same dead account - the failure was permanent from inside the app.
--
-- Without this column the fix cannot tell a correctly-created account from a
-- stale one, because Stripe's country only lives on Stripe's side.
--
-- Existing rows are backfilled to 'HU' rather than left NULL: every account
-- created before this migration genuinely IS Hungarian, and pretending we do
-- not know that would let the mismatch guard silently pass them through.

ALTER TABLE public.rentivo_operators
  ADD COLUMN IF NOT EXISTS stripe_account_country TEXT;

UPDATE public.rentivo_operators
   SET stripe_account_country = 'HU'
 WHERE stripe_account_id IS NOT NULL
   AND stripe_account_country IS NULL;

COMMENT ON COLUMN public.rentivo_operators.stripe_account_country IS
  'ISO-3166-1 alpha-2 the Connect account was created for. Immutable on Stripe''s side; used to detect an account that no longer matches the operator''s registered country.';

-- Operators must not be able to rewrite this: it is the evidence the mismatch
-- guard depends on, and a client that can edit it can bypass the guard.
REVOKE UPDATE (stripe_account_country) ON public.rentivo_operators FROM authenticated, anon;
