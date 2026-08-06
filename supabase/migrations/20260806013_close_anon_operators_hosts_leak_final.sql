-- Close the anonymous operators/hosts column leak, for real this time.
-- Both clients (app lib/api/listings.ts, web lib/listings.ts) no longer EMBED
-- the operator/host — they fetch listings, then read rentivo_operators_public /
-- rentivo_hosts_public by id in a second query and merge. No embed means no base
-- FK resolution, so anon needs no SELECT on the base tables at all.
--
-- authenticated KEEPS base SELECT: owner dashboard (own full row), admin
-- moderation, and the contract generator (operator legal fields for a booking's
-- parties) all legitimately read the base as an authenticated user. The
-- authenticated-horizontal residual (a signed-in user reading another operator's
-- sensitive columns directly) is tracked in docs/audits/AUDIT-2026-08-06.md and
-- is the follow-up (owner/admin RPC + authenticated revoke).
revoke select on public.rentivo_operators from anon;
revoke select on public.rentivo_hosts from anon;
