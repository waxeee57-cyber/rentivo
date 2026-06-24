-- ============================================================================
-- DRAFT — NOT APPLIED.  Seed/test relink of orphaned listings to an onboarded owner.
-- Prepared 2026-06-24 from a read-only audit.  Apply only when YOU choose to.
--
-- ⚠️ DO NOT run `supabase db push` to apply this. It lives OUTSIDE
--    supabase/migrations/ ON PURPOSE so that the GATED migration
--    supabase/migrations/20260624003_bookings_revoke_financial_insert.sql
--    is NOT swept in alongside it (that one must stay unapplied until the
--    mobile release). Apply this STANDALONE instead:
--      • Supabase SQL editor (runs as service-role / superuser), or
--      • MCP apply_migration / execute_sql (single statement set).
--
-- Idempotent: each UPDATE only overwrites a NULL owner (re-running is a no-op).
--
-- FACTS (source-tagged):
--   [DEPLOY] rentivo_operators — only operator, onboarded:
--     Test Operator  id f7c4a6b1-d748-4e04-9afd-126f140201e3
--     stripe_account_id acct_1TlrcY1i6DLADATb, stripe_onboarded=true
--   [DEPLOY] rentivo_listings orphans (operator_id IS NULL, owner_type='operator'):
--     Mercedes GLE 400    29bd5b55-358e-4992-a3e0-baa5174149eb
--     Porsche Cayenne     401fd88c-db00-4009-ab16-51a68ada2c6d
--     Sea Ray Sundancer   2ef4cd6e-e925-4509-8d0b-b681fe8f521b
--   [DEPLOY] rentivo_hosts — 0 rows → NO onboarded host exists.
-- ============================================================================

-- Operator-owned orphans → link to the onboarded Test Operator (seed/test link).
update public.rentivo_listings
   set operator_id = 'f7c4a6b1-d748-4e04-9afd-126f140201e3'
 where id = '29bd5b55-358e-4992-a3e0-baa5174149eb'   -- Mercedes GLE 400
   and operator_id is null;

update public.rentivo_listings
   set operator_id = 'f7c4a6b1-d748-4e04-9afd-126f140201e3'
 where id = '401fd88c-db00-4009-ab16-51a68ada2c6d'   -- Porsche Cayenne
   and operator_id is null;

update public.rentivo_listings
   set operator_id = 'f7c4a6b1-d748-4e04-9afd-126f140201e3'
 where id = '2ef4cd6e-e925-4509-8d0b-b681fe8f521b'   -- Sea Ray Sundancer
   and operator_id is null;

-- Villa Sol  0c082a08-d3c0-453b-bc5c-36a0eb413870  (owner_type='host', host_id IS NULL)
--   BLOCKED: rentivo_hosts is EMPTY — there is NO onboarded host to link to.
--   >>> HOST ONBOARDING REQUIRED FIRST <<<  Do NOT invent a host_id.
--   After a host exists + stripe_onboarded=true, apply (uncomment, fill the id):
--   update public.rentivo_listings
--      set host_id = '<ONBOARDED_HOST_ID>'
--    where id = '0c082a08-d3c0-453b-bc5c-36a0eb413870'
--      and host_id is null;

-- VERIFY after apply (expect 3 rows, all stripe_onboarded=true):
--   select l.id, l.title, l.operator_id, o.stripe_onboarded
--     from public.rentivo_listings l
--     left join public.rentivo_operators o on o.id = l.operator_id
--    where l.id in ('29bd5b55-358e-4992-a3e0-baa5174149eb',
--                   '401fd88c-db00-4009-ab16-51a68ada2c6d',
--                   '2ef4cd6e-e925-4509-8d0b-b681fe8f521b');
