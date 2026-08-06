-- Close the RPC surface the database linter found open, and fix the reason an
-- earlier migration believed it had already closed one of them.
--
-- 20260804001_booking_integrity.sql wrote:
--     REVOKE ALL ON FUNCTION public.increment_promo_use(TEXT) FROM PUBLIC;
--     GRANT EXECUTE ON FUNCTION public.increment_promo_use(TEXT) TO service_role;
-- and that is not enough on Supabase. `anon` and `authenticated` hold their own
-- EXPLICIT grants (handed out by ALTER DEFAULT PRIVILEGES on the public schema),
-- and revoking from PUBLIC does not touch an explicit grant to a named role. The
-- migration reported success and the hole stayed open — measured, not assumed:
-- an unauthenticated POST to /rest/v1/rpc/increment_promo_use carrying only the
-- publishable key (which ships inside the app bundle) returned `true` and moved
-- current_uses 0 -> 1. Looped, that drains any campaign with a max_uses cap
-- before a single real customer redeems it.

REVOKE ALL ON FUNCTION public.increment_promo_use(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_promo_use(text) TO service_role;

COMMENT ON FUNCTION public.increment_promo_use(text) IS
  'Redeems one use of a promo code. service_role ONLY — called by the create-booking edge function. '
  'Never grant to anon or authenticated: the caller chooses the code, so an EXECUTE grant is a free '
  'campaign-drain primitive. REVOKE FROM PUBLIC does not remove the named-role grants Supabase adds by default.';

-- Trigger function. It is only ever fired by a trigger on rentivo_damage_reports;
-- reachable as RPC it can do nothing useful (tg_op is unset outside a trigger and
-- it aborts), but an unnecessary entry point is still an entry point.
REVOKE ALL ON FUNCTION public.rentivo_sync_damage_done() FROM PUBLIC, anon, authenticated;

-- SECURITY INVOKER on purpose: the guard distinguishes the server from a renter
-- with `current_user in ('service_role','postgres','supabase_admin')`, which only
-- means anything while it runs as the caller. Do NOT make it SECURITY DEFINER.
-- Pinning search_path is still right: it stops a caller-supplied search_path from
-- resolving an unqualified name inside the function body to something they own.
ALTER FUNCTION public.rentivo_bookings_write_guard() SET search_path = public, pg_temp;

-- The Stripe webhook dedupe ledger. RLS is on and there is deliberately no policy,
-- which the linter flags as INFO because that shape is usually an accident — a
-- table nobody can read, silently. Here it is intentional, so say it with grants
-- rather than leaving it to be re-litigated: only the webhook (service_role)
-- touches this, and a client that could read it could enumerate payment activity.
REVOKE ALL ON TABLE public.rentivo_stripe_events FROM anon, authenticated;

COMMENT ON TABLE public.rentivo_stripe_events IS
  'Stripe event dedupe ledger. service_role only, by grant AND by RLS-with-no-policy. '
  'The empty policy list is intentional, not an oversight.';
