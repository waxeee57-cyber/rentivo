-- ════════════════════════════════════════════════════════════════════════════
-- Capture the deploy-only hotfix (live migration 20260611145437) in the repo.
-- ════════════════════════════════════════════════════════════════════════════
-- DRIFT: production already has str_compliance_status with security_invoker=true,
-- but repo migration 27_str_view_and_deleted_user.sql (and 22_str_compliance.sql)
-- recreate the view WITHOUT that option. On a fresh `supabase db reset` / re-apply
-- the view would be re-created as security_invoker=false (runs with the VIEW
-- OWNER's privileges), bypassing rentivo_listings RLS for whoever queries it.
--
-- This migration runs AFTER 27 and makes the repo self-healing: it pins
-- security_invoker=true so re-apply can never re-introduce the RLS bypass.
-- Idempotent + reversible (ALTER VIEW ... SET (security_invoker=false) to undo).
-- ════════════════════════════════════════════════════════════════════════════

ALTER VIEW IF EXISTS public.str_compliance_status SET (security_invoker = true);
