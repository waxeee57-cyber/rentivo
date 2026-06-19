-- ════════════════════════════════════════════════════════════════════════════
-- B1 — rentivo_users: privileged-column write-guard
-- ════════════════════════════════════════════════════════════════════════════
-- Additive + idempotent. Safe to re-run. No DROP that breaks a legit flow.
--
-- Threat: the "Users update own profile" UPDATE policy has an EMPTY WITH CHECK and
-- `authenticated` held a table-wide UPDATE grant, so any signed-in user could PATCH
-- their own row to is_admin=true (admin takeover — gates charge-deposit & dispute
-- resolution), verification_status='verified' (KYC bypass), is_banned=false, etc.
--
-- Discovery — legit authenticated writes that MUST keep working:
--   * verification_status -> 'pending'  : the user submits KYC docs
--                                          (app/(consumer)/profile/verify.tsx:120)
--   * is_banned                          : intended for admin moderation
--                                          (app/(admin)/users.tsx:68)
--   * profile columns (name/avatar_url/phone/bio/push_token/...) : free
--   No client path writes is_admin / identity_status / is_verified / role.
--
-- Two layers:
--   (1) BEFORE UPDATE trigger keyed on auth.uid():
--        - service_role / superuser (uid NULL) -> allow (edge, didit-webhook, SQL)
--        - caller is_admin = true              -> allow (admin moderation)
--        - regular user -> block changes to is_admin, is_banned, identity_status,
--          is_verified, role; allow verification_status only -> 'pending'.
--      No bootstrap: a non-admin's is_admin is still false at trigger time.
--   (2) Column-level privilege: REVOKE the table-wide UPDATE and re-GRANT UPDATE on
--       every column EXCEPT the server-only set (is_admin, identity_status,
--       is_verified, role). is_banned + verification_status stay grantable
--       (admin/user) and are gated by the trigger.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rentivo_users_guard_privileged_columns()
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

  IF NEW.is_admin           IS DISTINCT FROM OLD.is_admin
     OR NEW.is_banned       IS DISTINCT FROM OLD.is_banned
     OR NEW.identity_status IS DISTINCT FROM OLD.identity_status
     OR NEW.is_verified     IS DISTINCT FROM OLD.is_verified
     OR NEW.role            IS DISTINCT FROM OLD.role
  THEN
    RAISE EXCEPTION
      'rentivo_users: privileged columns are admin/server-only. User % attempted a forbidden update.', auth.uid()
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     AND NEW.verification_status IS DISTINCT FROM 'pending'
  THEN
    RAISE EXCEPTION
      'rentivo_users: verification_status may only be set to pending by the user (approval is server-only). User % attempted "%".', auth.uid(), NEW.verification_status
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rentivo_users_guard_privileged ON public.rentivo_users;
CREATE TRIGGER rentivo_users_guard_privileged
  BEFORE UPDATE ON public.rentivo_users
  FOR EACH ROW
  EXECUTE FUNCTION public.rentivo_users_guard_privileged_columns();

-- (2) Column-level UPDATE: grant every column EXCEPT the server-only privileged set.
DO $$
DECLARE cols text;
BEGIN
  REVOKE UPDATE ON public.rentivo_users FROM authenticated;
  SELECT string_agg(quote_ident(column_name), ', ')
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'rentivo_users'
    AND column_name NOT IN ('is_admin','identity_status','is_verified','role');
  EXECUTE format('GRANT UPDATE (%s) ON public.rentivo_users TO authenticated', cols);
END $$;

COMMENT ON FUNCTION public.rentivo_users_guard_privileged_columns() IS
  'B1 write-guard: blocks non-admin authenticated clients from changing is_admin/is_banned/
   identity_status/is_verified/role and from setting verification_status to anything but
   pending. Admins and service_role bypass.';

-- The guard is a trigger function: it fires as a trigger regardless of EXECUTE grants,
-- so it must NOT be directly /rpc/-callable. (Closes the anon/authenticated
-- security_definer_function_executable advisors.)
REVOKE EXECUTE ON FUNCTION public.rentivo_users_guard_privileged_columns() FROM PUBLIC, anon, authenticated;
