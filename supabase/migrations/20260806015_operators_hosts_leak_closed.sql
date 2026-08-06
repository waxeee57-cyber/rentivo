-- Supersedes the PRE-LAUNCH SECURITY TODO comments written by
-- 20260806011_operators_hosts_leak_documented.sql. The HIGH anon column leak on
-- rentivo_operators / rentivo_hosts is now CLOSED and verified (2026-08-06):
--   * public marketing views rentivo_operators_public / rentivo_hosts_public
--     (20260806012) carry only safe columns for active rows;
--   * both clients fetch listings then hydrate owners via those views (two-query,
--     no PostgREST embed) — app lib/api/listings.ts, web lib/listings.ts;
--   * anon SELECT on the base tables is REVOKED (20260806013);
--   * the listing owner-management policies were re-scoped to `authenticated`
--     (20260806014) so the anon storefront read still works.
-- Measured with the anon publishable key: base rentivo_operators/hosts sensitive
-- columns -> 401; the _public views -> 200; anon rentivo_listings -> 200 with rows.
--
-- REMAINING (tracked, not a launch blocker): the authenticated-horizontal residual
-- — a signed-in user can still read another operator's/host's sensitive base
-- columns directly, because `authenticated` legitimately keeps base SELECT for the
-- owner dashboard, admin moderation, and the contract generator. Follow-up is an
-- own-row/admin RPC + revoke of base SELECT from `authenticated`. See
-- docs/audits/AUDIT-2026-08-06.md.

comment on table public.rentivo_operators is
  'anon SELECT is REVOKED (leak closed 2026-08-06). Public marketing data is served '
  'by the rentivo_operators_public view; clients hydrate owners against that view, '
  'never embed the base table. authenticated keeps base SELECT for owner/admin/'
  'contract flows (authenticated-horizontal residual tracked in AUDIT-2026-08-06.md).';

comment on table public.rentivo_hosts is
  'anon SELECT is REVOKED (leak closed 2026-08-06). Public marketing data is served '
  'by the rentivo_hosts_public view; clients hydrate owners against that view, never '
  'embed the base table. authenticated keeps base SELECT for owner/admin/contract '
  'flows (authenticated-horizontal residual tracked in AUDIT-2026-08-06.md).';
