-- ═══════════════════════════════════════════════════════════════════════════
-- 1. KYC bypass. `authenticated` held INSERT on every column of
--    rentivo_identity_verifications, and the only INSERT policy checked
--    ownership (user_id = auth.uid()) rather than content. One request with
--    {status:'approved', liveness_passed:true} made the booking gate at
--    app/(consumer)/booking/[listingId].tsx treat the caller as verified,
--    because it reads the newest row for that user. Identity verification was
--    self-service. Only didit-webhook (service role) may write these rows.
-- ═══════════════════════════════════════════════════════════════════════════
revoke insert, update, delete on public.rentivo_identity_verifications from anon, authenticated;

create index if not exists rentivo_identity_verifications_user_created_idx
  on public.rentivo_identity_verifications (user_id, created_at desc);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Admin actions were writing to tables with no admin policy, so every one of
--    them matched zero rows. supabase-js reports no error for a zero-row UPDATE,
--    so banning a user, approving an operator and disabling a promo code all
--    showed a success toast and changed nothing.
--
--    SECURITY DEFINER because a policy ON rentivo_users that reads
--    rentivo_users would recurse through its own RLS.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.rentivo_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rentivo_users u
    where (u.auth_id = (select auth.uid()) or u.id = (select auth.uid()))
      and u.is_admin is true
  );
$$;

revoke all on function public.rentivo_is_admin() from public;
grant execute on function public.rentivo_is_admin() to authenticated, service_role;

drop policy if exists "Admins manage users" on public.rentivo_users;
create policy "Admins manage users"
  on public.rentivo_users for update
  using (public.rentivo_is_admin())
  with check (public.rentivo_is_admin());

drop policy if exists "Admins read users" on public.rentivo_users;
create policy "Admins read users"
  on public.rentivo_users for select
  using (public.rentivo_is_admin());

drop policy if exists "Admins manage operators" on public.rentivo_operators;
create policy "Admins manage operators"
  on public.rentivo_operators for update
  using (public.rentivo_is_admin())
  with check (public.rentivo_is_admin());

drop policy if exists "Admins manage promo codes" on public.rentivo_promo_codes;
create policy "Admins manage promo codes"
  on public.rentivo_promo_codes for all
  using (public.rentivo_is_admin())
  with check (public.rentivo_is_admin());

drop policy if exists "Admins handle reports" on public.rentivo_reports;
create policy "Admins handle reports"
  on public.rentivo_reports for all
  using (public.rentivo_is_admin())
  with check (public.rentivo_is_admin());

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. anon write grants on privileged tables. RLS blocks them today only because
--    every policy keys off auth.uid(), which is NULL for anon. That is one
--    policy edit away from being a hole, and no anon client writes these.
-- ═══════════════════════════════════════════════════════════════════════════
revoke insert, update, delete on
  public.rentivo_admin_logs,
  public.rentivo_api_keys,
  public.rentivo_reports,
  public.rentivo_disputes
from anon;

revoke insert, update on public.rentivo_users from anon;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. A dispute could be attached to a stranger's booking: the INSERT policy
--    checked only that raised_by_auth_id was the caller, never that the caller
--    was a party to booking_id. The booking's operator then saw a dispute
--    raised by someone with no relationship to the rental.
-- ═══════════════════════════════════════════════════════════════════════════
drop policy if exists disputes_insert on public.rentivo_disputes;
create policy disputes_insert
  on public.rentivo_disputes for insert
  with check (
    raised_by_auth_id = (select auth.uid())
    and exists (
      select 1 from public.rentivo_bookings b
      where b.id = rentivo_disputes.booking_id
        and (
          b.user_id = (select auth.uid())
          or exists (select 1 from public.rentivo_operators o
                     where o.id = b.operator_id and o.auth_id = (select auth.uid()))
          or exists (select 1 from public.rentivo_hosts h
                     where h.id = b.host_id and h.auth_id = (select auth.uid()))
        )
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. ical-export took a listing_id from the query string, had no Authorization
--    check at all, and queried with the service role. Listing ids are public,
--    so anyone could read the confirmed booking date ranges of any listing on
--    the platform: occupancy intelligence for a competitor, and an "empty right
--    now" signal. A subscribing calendar app cannot send an Authorization
--    header, so the capability has to live in the URL.
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.rentivo_listings
  add column if not exists ical_feed_token uuid not null default gen_random_uuid();

revoke update (ical_feed_token) on public.rentivo_listings from anon, authenticated;

create index if not exists rentivo_listings_ical_feed_token_idx
  on public.rentivo_listings (ical_feed_token);
