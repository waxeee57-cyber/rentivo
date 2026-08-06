-- Curated PUBLIC projections of the two profile tables: marketing columns only,
-- active rows only. These are what anon/authenticated will embed against so the
-- sensitive base columns (stripe_account_id, email, phone, auth_id, legal_name,
-- vat_number, kyc_*, push_token, registered_address, suspension_reason) never
-- reach a non-owner. Additive for now — no base grants change in THIS migration,
-- so the running app/web is unaffected until the embeds are repointed.
--
-- These are SECURITY DEFINER views (the default) on purpose: anon will have its
-- base-table SELECT revoked, so a security_invoker view would fail for lack of
-- base privilege. The explicit column list + `where active` is the whole
-- exposure surface; there is no sensitive column to leak and no way to widen it
-- without editing this view.

create or replace view public.rentivo_operators_public as
  select id, name, slug, description, logo_url, cover_image_url, city, country,
         latitude, longitude, rating, review_count, verified, active,
         stripe_onboarded, tier, total_bookings, response_rate, avg_rating,
         requires_identity_verification, approved, delivery_enabled,
         delivery_radius_km, delivery_fee_eur, delivery_zones, website, created_at
  from public.rentivo_operators
  where active = true;

create or replace view public.rentivo_hosts_public as
  select id, name, bio, avatar_url, city, country, rating, review_count, verified,
         identity_verified, response_rate, response_time, member_since,
         total_rentals, active, stripe_onboarded, created_at
  from public.rentivo_hosts
  where active = true;

grant select on public.rentivo_operators_public to anon, authenticated;
grant select on public.rentivo_hosts_public to anon, authenticated;

comment on view public.rentivo_operators_public is
  'Public marketing projection of rentivo_operators (active rows, safe columns only). '
  'Clients embed listings against THIS, never the base table. Do not add sensitive columns.';
comment on view public.rentivo_hosts_public is
  'Public marketing projection of rentivo_hosts (active rows, safe columns only). '
  'Clients embed listings against THIS, never the base table. Do not add sensitive columns.';
