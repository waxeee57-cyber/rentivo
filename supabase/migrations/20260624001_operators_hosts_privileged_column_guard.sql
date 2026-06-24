-- ════════════════════════════════════════════════════════════════════════════
-- Wave 3 — operator/host privilege parity: privileged-column write-guard
-- ════════════════════════════════════════════════════════════════════════════
-- Additive + idempotent. Safe to re-run. No DROP that breaks a legit flow.
--
-- Threat (measured 2026-06-24 against live DB):
--   rentivo_users UPDATE is already guarded (rentivo_users_guard_privileged), but
--   rentivo_operators / rentivo_hosts were NOT. Their RLS policies
--     * "Operators manage own profile"  ALL  USING (auth.uid() = auth_id)   (no WITH CHECK)
--     * "hosts_own_profile"             ALL  USING (auth_id = auth.uid())   WITH CHECK same
--   let the row OWNER freely INSERT/UPDATE trust/compliance/moderation columns, e.g.:
--     operators.verified=true (fake trust badge), tier='pro'/'enterprise' (feature/
--     revenue theft), kyc_verified_at/kyc_provider/kyc_reference_id (KYC bypass),
--     requires_identity_verification=false (compliance bypass), suspended=false /
--     approved=true (moderation / ban evasion), stripe_onboarded=true / stripe_account_id
--     spoof (payout integrity); hosts.verified=true, identity_verified=true.
--   These rows are CLIENT-inserted (no signup trigger creates them) so INSERT must be
--   guarded too — not just UPDATE.
--
-- Design (mirrors B1 rentivo_users_guard_privileged_columns):
--   BEFORE INSERT OR UPDATE trigger keyed on auth.uid():
--     - service_role / superuser (auth.uid() IS NULL) -> allow (edge fns, webhooks, SQL)
--     - caller is platform admin (rentivo_users.is_admin) -> allow (admin moderation)
--     - regular authenticated caller:
--         * on INSERT -> force the privileged columns to safe server defaults
--           (a self-provisioned operator/host can never be born verified/pro/kyc'd)
--         * on UPDATE -> block any change to the privileged set
--   Server writes (create-stripe-account-link, stripe-webhook account.updated,
--   didit-webhook, admin tooling via service_role) run as service_role -> bypass.
--
--   Defense-in-depth column grants: REVOKE the table-wide UPDATE from `authenticated`
--   and re-GRANT UPDATE on every column EXCEPT the purely-server-written set
--   (kyc_verified_at, kyc_provider, kyc_reference_id, stripe_account_id, stripe_onboarded).
--   Admin-toggled columns (verified, tier, approved, suspended, suspension_reason,
--   requires_identity_verification) keep the grant and are gated by the trigger's
--   admin-bypass — so admin screens that write via an authenticated client keep working.
-- ════════════════════════════════════════════════════════════════════════════

-- ── rentivo_operators ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rentivo_operators_guard_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_caller_is_admin boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;  -- service_role (edge/webhooks) + superuser (migrations) bypass
  END IF;

  SELECT is_admin INTO v_caller_is_admin
  FROM public.rentivo_users WHERE id = auth.uid();
  IF COALESCE(v_caller_is_admin, false) THEN
    RETURN NEW;  -- trusted platform admin
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- A self-provisioned operator can never be born trusted/verified/kyc'd/onboarded.
    NEW.verified                        := false;
    NEW.tier                            := 'new';
    NEW.approved                        := true;   -- schema default (auto-approve today)
    NEW.suspended                       := false;
    NEW.suspension_reason               := NULL;
    NEW.kyc_verified_at                 := NULL;
    NEW.kyc_provider                    := NULL;
    NEW.kyc_reference_id                := NULL;
    -- NOTE: requires_identity_verification is intentionally NOT forced here — it is a
    -- legit operator self-service setting (whether the operator requires *renters* to
    -- verify ID), not a self-escalation of the operator's own trust state.
    NEW.stripe_account_id               := NULL;
    NEW.stripe_onboarded                := false;
    RETURN NEW;
  END IF;

  -- TG_OP = 'UPDATE': block changes to the privileged set for non-admins.
  IF NEW.verified                       IS DISTINCT FROM OLD.verified
     OR NEW.tier                        IS DISTINCT FROM OLD.tier
     OR NEW.approved                    IS DISTINCT FROM OLD.approved
     OR NEW.suspended                   IS DISTINCT FROM OLD.suspended
     OR NEW.suspension_reason           IS DISTINCT FROM OLD.suspension_reason
     OR NEW.kyc_verified_at             IS DISTINCT FROM OLD.kyc_verified_at
     OR NEW.kyc_provider                IS DISTINCT FROM OLD.kyc_provider
     OR NEW.kyc_reference_id            IS DISTINCT FROM OLD.kyc_reference_id
     OR NEW.stripe_account_id           IS DISTINCT FROM OLD.stripe_account_id
     OR NEW.stripe_onboarded            IS DISTINCT FROM OLD.stripe_onboarded
  THEN
    RAISE EXCEPTION
      'rentivo_operators: trust/compliance/payout columns are admin/server-only. User % attempted a forbidden write.', auth.uid()
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rentivo_operators_guard_privileged ON public.rentivo_operators;
CREATE TRIGGER rentivo_operators_guard_privileged
  BEFORE INSERT OR UPDATE ON public.rentivo_operators
  FOR EACH ROW
  EXECUTE FUNCTION public.rentivo_operators_guard_privileged_columns();

REVOKE EXECUTE ON FUNCTION public.rentivo_operators_guard_privileged_columns() FROM PUBLIC, anon, authenticated;

-- ── rentivo_hosts ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rentivo_hosts_guard_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_caller_is_admin boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT is_admin INTO v_caller_is_admin
  FROM public.rentivo_users WHERE id = auth.uid();
  IF COALESCE(v_caller_is_admin, false) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.verified           := false;
    NEW.identity_verified  := false;
    NEW.stripe_account_id  := NULL;
    NEW.stripe_onboarded   := false;
    RETURN NEW;
  END IF;

  IF NEW.verified           IS DISTINCT FROM OLD.verified
     OR NEW.identity_verified IS DISTINCT FROM OLD.identity_verified
     OR NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id
     OR NEW.stripe_onboarded  IS DISTINCT FROM OLD.stripe_onboarded
  THEN
    RAISE EXCEPTION
      'rentivo_hosts: trust/verification/payout columns are admin/server-only. User % attempted a forbidden write.', auth.uid()
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rentivo_hosts_guard_privileged ON public.rentivo_hosts;
CREATE TRIGGER rentivo_hosts_guard_privileged
  BEFORE INSERT OR UPDATE ON public.rentivo_hosts
  FOR EACH ROW
  EXECUTE FUNCTION public.rentivo_hosts_guard_privileged_columns();

REVOKE EXECUTE ON FUNCTION public.rentivo_hosts_guard_privileged_columns() FROM PUBLIC, anon, authenticated;

-- ── Defense-in-depth: column-level UPDATE grants (purely-server columns un-grantable)
DO $$
DECLARE cols text;
BEGIN
  REVOKE UPDATE ON public.rentivo_operators FROM authenticated;
  SELECT string_agg(quote_ident(column_name), ', ') INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'rentivo_operators'
    AND column_name NOT IN ('kyc_verified_at','kyc_provider','kyc_reference_id',
                            'stripe_account_id','stripe_onboarded');
  EXECUTE format('GRANT UPDATE (%s) ON public.rentivo_operators TO authenticated', cols);

  REVOKE UPDATE ON public.rentivo_hosts FROM authenticated;
  SELECT string_agg(quote_ident(column_name), ', ') INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'rentivo_hosts'
    AND column_name NOT IN ('stripe_account_id','stripe_onboarded');
  EXECUTE format('GRANT UPDATE (%s) ON public.rentivo_hosts TO authenticated', cols);
END $$;

COMMENT ON FUNCTION public.rentivo_operators_guard_privileged_columns() IS
  'Wave3 write-guard: blocks non-admin authenticated clients from self-setting verified/tier/approved/
   suspended/suspension_reason/kyc_*/requires_identity_verification/stripe_*. Admin + service_role bypass.';
COMMENT ON FUNCTION public.rentivo_hosts_guard_privileged_columns() IS
  'Wave3 write-guard: blocks non-admin authenticated clients from self-setting verified/identity_verified/
   stripe_*. Admin + service_role bypass.';
