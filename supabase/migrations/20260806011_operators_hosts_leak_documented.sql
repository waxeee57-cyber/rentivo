-- Documents a CONFIRMED, still-OPEN security finding on the two public profile
-- tables. This migration changes NO grants (the exploration migration
-- operators_hosts_anon_column_scope was reverted — see below); it only records
-- the finding on the table so it cannot be forgotten.
--
-- FINDING (measured 2026-08-06, HIGH): an anonymous caller holding only the
-- publishable key can read ALL columns of every active operator/host via the
-- "Anyone can view active operators" / "public_read_hosts" SELECT policies plus
-- the table-level SELECT grant. Confirmed leaked to anon:
--   rentivo_operators : stripe_account_id (all rows), email, phone, and — whenever
--                       populated — legal_name, vat_number, registration_number,
--                       registered_address, kyc_provider, kyc_reference_id,
--                       kyc_verified_at, push_token, suspension_reason.
--   rentivo_hosts     : auth_id (the auth.users UUID), email, stripe_account_id,
--                       phone, push_token.
--
-- WHY NOT FIXED HERE: the clients embed operator:rentivo_operators(*) throughout
-- listings/bookings, and PostgREST resource embedding requires TABLE-level SELECT
-- (a column-only grant makes select=* and every embed 401 — measured). So the
-- correct fix is a security_invoker VIEW of the marketing columns that the clients
-- embed against, plus REVOKE of the sensitive base columns from anon (and, for the
-- authenticated-horizontal residual, from authenticated with owner/admin served by
-- a SECURITY DEFINER own-row RPC). That is a coordinated schema + client change
-- that must be applied with the app running so the storefront and the operator/
-- admin dashboards are verified — not shipped blind. Currently only test-fixture
-- rows exist (no real operator has onboarded), so no real customer data is exposed
-- yet; this must be closed BEFORE real operators onboard.

comment on table public.rentivo_operators is
  'PRE-LAUNCH SECURITY TODO (HIGH): anon can read ALL columns (incl. stripe_account_id, '
  'email, phone, and any populated legal_name/vat_number/registration_number/'
  'registered_address/kyc_*/push_token) via "Anyone can view active operators" + the '
  'table SELECT grant. Fix: security_invoker public view of marketing columns + REVOKE '
  'sensitive base columns; repoint client embeds at the view. Column-only grants do '
  'NOT work — PostgREST embeds need table SELECT. Audit 2026-08-06.';

comment on table public.rentivo_hosts is
  'PRE-LAUNCH SECURITY TODO (HIGH): anon can read ALL columns (incl. auth_id, email, '
  'phone, stripe_account_id, push_token) via "public_read_hosts" + the table SELECT '
  'grant. Same fix as rentivo_operators. Audit 2026-08-06.';
