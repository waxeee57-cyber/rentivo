-- Anyone holding the publishable key could list every live campaign.
--
-- The policy was `Public can read active promo codes` USING (is_active AND not
-- exhausted AND in its date window). Each condition is sensible on its own, and
-- together they answer the wrong question: a caller does not have to name a code
-- to get a row back, so `select * from rentivo_promo_codes` returned the whole
-- live campaign list — code, percentage, cap, uses remaining — to a stranger.
-- Measured, not inferred: an unauthenticated GET returned WELCOME10 (10%) and
-- MARBELLA20 (20%) among others.
--
-- That defeats the point of a promo code. A partner code, a win-back code, an
-- influencer code and a 50%-off apology code are all worth exactly as much as
-- the fact that only their intended recipient knows them.
--
-- The renter still has to be able to check a code they were GIVEN — the booking
-- screen shows "Promo applied: -EUR 49.50" before the Pay button, and it must
-- agree with what create-booking will charge. So: keep the lookup, remove the
-- listing. A caller may ask about one code by name and learns nothing about any
-- other.
--
-- This does not stop someone guessing codes one at a time; nothing short of rate
-- limiting does, and that is a different job. It stops the one-request dump,
-- which is the difference between an attack and a download.

DROP POLICY IF EXISTS "Public can read active promo codes" ON public.rentivo_promo_codes;

CREATE OR REPLACE FUNCTION public.rentivo_lookup_promo(p_code text)
RETURNS TABLE (
  id uuid,
  code text,
  discount_type text,
  discount_value numeric,
  min_booking_value numeric,
  max_uses integer,
  current_uses integer,
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  -- Exact match on a caller-supplied code, case-insensitive because the input is
  -- typed by a human. No wildcard, no LIKE, no "return everything when the
  -- argument is blank": an empty or null p_code matches nothing, which is what
  -- turns this from a lookup back into a list.
  select c.id, c.code, c.discount_type, c.discount_value, c.min_booking_value,
         c.max_uses, c.current_uses, c.valid_from, c.valid_until, c.is_active
  from public.rentivo_promo_codes c
  where nullif(btrim(p_code), '') is not null
    and upper(c.code) = upper(btrim(p_code))
  limit 1;
$$;

REVOKE ALL ON FUNCTION public.rentivo_lookup_promo(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rentivo_lookup_promo(text) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.rentivo_lookup_promo(text) IS
  'Look up ONE promo code by exact name. Deliberately the only read path to rentivo_promo_codes '
  'for non-admins: the table itself is not selectable, so the campaign list cannot be dumped. '
  'Returns validity fields raw and lets the caller decide — lib/api/promo.ts mirrors the checks '
  'create-booking makes, and moving them in here would let the two drift apart silently.';

COMMENT ON TABLE public.rentivo_promo_codes IS
  'Campaign codes. Not readable by anon or authenticated: admins read it through the '
  '"Admins manage promo codes" policy, renters check a single code through rentivo_lookup_promo(), '
  'and the server redeems through increment_promo_use(). Do not add a permissive SELECT policy '
  'without one — a policy that does not require the caller to name a code makes the table a list.';
