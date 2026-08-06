-- Seed the isolated E2E fixtures. Idempotent: safe to re-run.
--
-- See scripts/e2e/fixtures.mjs for why each suite owns its own listing, its own
-- date window, and (where it mutates operator state) its own operator.
--
-- Run with a service-role connection. Applied 2026-08-06.

-- A private operator for identity-gate, which flips requires_identity_verification
-- and would otherwise 403 every other suite booking the shared operator.
-- auth_id is NULL on purpose: nothing signs in as it, and the unique index on
-- auth_id permits multiple NULLs.
insert into public.rentivo_operators
  (id, auth_id, name, slug, city, country, latitude, longitude,
   stripe_account_id, stripe_account_country, stripe_onboarded, approved,
   requires_identity_verification)
values
  ('e2e0ec70-0000-4e2e-9000-000000000101', null, 'E2E Identity Operator',
   'e2e-identity-op', 'Marbella', 'ES', 36.5101, -4.8824,
   'acct_1Tqc56ER42YjEKEJ', 'HU', true, true, false)
on conflict (id) do update
  set stripe_onboarded = true, approved = true;

-- A private operator for admin.mjs, which approves and suspends one. That used
-- to be the seeded "Test Operator", whose auth_id is the PROJECT OWNER's account
-- and whose listings four other suites book: for the length of section 3 every
-- one of them was reading a suspended, un-approved owner. This row owns no
-- listings on purpose — it exists to be sanctioned and put back.
insert into public.rentivo_operators
  (id, auth_id, name, slug, city, country, latitude, longitude,
   stripe_account_id, stripe_account_country, stripe_onboarded, approved, suspended,
   requires_identity_verification)
values
  ('e2eadd11-0000-4e2e-9000-0000000000ad', null, 'E2E Admin Sanction Operator',
   'e2e-admin-sanction-op', 'Marbella', 'ES', 36.5101, -4.8824,
   'acct_1Tqc56ER42YjEKEJ', 'HU', true, true, false, false)
on conflict (id) do update
  set stripe_onboarded = true, approved = true, suspended = false;

-- Two accounts that exist so admin.mjs and identity-gate.mjs stop borrowing the
-- GDPR subject's. auth.users rows cannot be seeded from SQL (the password is
-- hashed by GoTrue and must never be written here), so they are created by
-- signing up once through the API and then confirmed:
--
--   update auth.users set email_confirmed_at = now()
--   where email in ('e2e-adminuser@rentivo.domrol.com', 'e2e-identity@rentivo.domrol.com')
--     and email_confirmed_at is null;

-- One listing per suite.
insert into public.rentivo_listings
  (id, operator_id, owner_type, title, category, price_per_day, deposit_amount,
   currency, available, min_rental_days, features, images, cancellation_policy,
   instant_book)
values
  ('e2e11111-0000-4e2e-9000-000000000001', 'b1e2c3d4-0000-4e2e-9000-0000000000e2', 'operator', 'E2E Money Path Car', 'car', 150, 0,   'EUR', true, 1, '{}', '{}', 'moderate', true),
  ('e2e11111-0000-4e2e-9000-000000000002', 'b1e2c3d4-0000-4e2e-9000-0000000000e2', 'operator', 'E2E Contract Car',   'car', 220, 0,   'EUR', true, 1, '{}', '{}', 'moderate', true),
  ('e2e11111-0000-4e2e-9000-000000000003', 'b1e2c3d4-0000-4e2e-9000-0000000000e2', 'operator', 'E2E Messaging Car',  'car', 180, 0,   'EUR', true, 1, '{}', '{}', 'moderate', true),
  ('e2e11111-0000-4e2e-9000-000000000004', 'b1e2c3d4-0000-4e2e-9000-0000000000e2', 'operator', 'E2E GDPR Car',       'car', 400, 0,   'EUR', true, 1, '{}', '{}', 'moderate', true),
  ('e2e11111-0000-4e2e-9000-000000000005', 'e2e0ec70-0000-4e2e-9000-000000000101', 'operator', 'E2E Identity Car',   'car', 250, 0,   'EUR', true, 1, '{}', '{}', 'moderate', true),
  ('e2e11111-0000-4e2e-9000-000000000006', 'b1e2c3d4-0000-4e2e-9000-0000000000e2', 'operator', 'E2E Admin Car',      'car', 300, 0,   'EUR', true, 1, '{}', '{}', 'moderate', true),
  ('e2e11111-0000-4e2e-9000-00000000da11', 'b1e2c3d4-0000-4e2e-9000-0000000000e2', 'operator', 'E2E Damage Fixture Car', 'car', 200, 500, 'EUR', true, 1, '{}', '{}', 'moderate', true)
on conflict (id) do update
  set operator_id   = excluded.operator_id,
      available     = true,
      price_per_day = excluded.price_per_day,
      deposit_amount = excluded.deposit_amount;
