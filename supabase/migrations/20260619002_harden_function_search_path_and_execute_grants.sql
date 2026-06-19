-- 20260619002_harden_function_search_path_and_execute_grants
-- Security hardening — ADDITIVE + IDEMPOTENT (safe to re-run). No DROP, no data
-- change, no function-body change.
--
-- Clears these Supabase security advisors:
--   * function_search_path_mutable            (6 trigger functions)
--   * anon_security_definer_function_executable / authenticated_..._executable
--                                              (5 trigger / event-trigger functions)
--
-- SCOPE GUARANTEE: touches ONLY trigger / event-trigger helper functions. No
-- payment / deposit / webhook function (create-payment-intent, charge-deposit,
-- create-deposit-setup, stripe-webhook) is referenced or redeployed.
--
-- (1) Pin search_path on the flagged functions. All are no-arg functions whose
--     bodies reference only public.* objects (pg_catalog is always implicitly
--     searched), so `public, pg_temp` cannot change their behaviour. Verified
--     against pg_get_functiondef before applying.
--
-- (2) Remove EXECUTE from the exposed PostgREST roles on SECURITY DEFINER trigger /
--     event-trigger functions. Trigger execution does NOT check EXECUTE on the
--     firing user, so this has ZERO effect on signup / booking-completion / chat /
--     rls-auto-enable — it only closes the /rest/v1/rpc/<fn> direct-call surface.
--     PUBLIC is included deliberately: the live grant set is
--     `{=X (PUBLIC), anon, authenticated, service_role}`; revoking only anon +
--     authenticated leaves the PUBLIC grant, so the advisor would stay red and the
--     RPC surface would remain open. service_role and the owner (postgres) keep
--     EXECUTE.

-- ── (1) search_path pinning ──────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regprocedure('public.handle_new_user()') IS NOT NULL THEN
    ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
  END IF;
  IF to_regprocedure('public.update_listing_rating()') IS NOT NULL THEN
    ALTER FUNCTION public.update_listing_rating() SET search_path = public, pg_temp;
  END IF;
  IF to_regprocedure('public.check_review_eligibility()') IS NOT NULL THEN
    ALTER FUNCTION public.check_review_eligibility() SET search_path = public, pg_temp;
  END IF;
  IF to_regprocedure('public.add_loyalty_points()') IS NOT NULL THEN
    ALTER FUNCTION public.add_loyalty_points() SET search_path = public, pg_temp;
  END IF;
  IF to_regprocedure('public.update_updated_at_column()') IS NOT NULL THEN
    ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
  END IF;
  IF to_regprocedure('public.handle_booking_completed()') IS NOT NULL THEN
    ALTER FUNCTION public.handle_booking_completed() SET search_path = public, pg_temp;
  END IF;
END $$;

-- ── (2) EXECUTE revoke on trigger / event-trigger SECURITY DEFINER functions ──
DO $$
BEGIN
  IF to_regprocedure('public.add_loyalty_points()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.add_loyalty_points() FROM PUBLIC, anon, authenticated;
  END IF;
  IF to_regprocedure('public.handle_booking_completed()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.handle_booking_completed() FROM PUBLIC, anon, authenticated;
  END IF;
  IF to_regprocedure('public.handle_new_user()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
  END IF;
  IF to_regprocedure('public.rentivo_conversations_guard_binding_columns()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.rentivo_conversations_guard_binding_columns() FROM PUBLIC, anon, authenticated;
  END IF;
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
  END IF;
END $$;
