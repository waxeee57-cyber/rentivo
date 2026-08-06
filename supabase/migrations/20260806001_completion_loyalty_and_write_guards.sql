-- ═══════════════════════════════════════════════════════════════════════════
-- 1. NO BOOKING HAS EVER BEEN COMPLETED.
--
-- handle_booking_completed() fires on every transition to status='completed'
-- and has THREE independently fatal errors:
--   * it inserts `reason` and `created_at` into rentivo_loyalty, which has
--     neither column (42703)
--   * `ON CONFLICT (booking_id)` — no unique index on booking_id (42P10)
--   * `ON CONFLICT (user_id)` — no unique index on user_id either (42P10)
--
-- So the UPDATE aborts, and status can never reach 'completed'. Live evidence:
-- 36 bookings, statuses pending/confirmed/cancelled only, rentivo_loyalty and
-- rentivo_reviews both empty. check_review_eligibility() requires a completed
-- booking, so the review feature has never functioned either, and no loyalty
-- point has ever been awarded against tiers the profile screen advertises.
-- ═══════════════════════════════════════════════════════════════════════════
create unique index if not exists rentivo_loyalty_user_id_key
  on public.rentivo_loyalty (user_id);

create or replace function public.handle_booking_completed()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  points_earned integer;
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    points_earned := floor(coalesce(new.total_amount, 0))::integer;

    -- One row per user. `booking_id` records the booking that last awarded, so
    -- a completed -> active -> completed bounce cannot pay out twice.
    insert into public.rentivo_loyalty (user_id, booking_id, points, total_earned)
    values (new.user_id, new.id, points_earned, points_earned)
    on conflict (user_id) do update
    set points       = rentivo_loyalty.points + excluded.points,
        total_earned = rentivo_loyalty.total_earned + excluded.total_earned,
        booking_id   = excluded.booking_id,
        updated_at   = now()
    where rentivo_loyalty.booking_id is distinct from new.id;

    update public.rentivo_loyalty
    set tier = case
      when total_earned >= 5000 then 'gold'
      when total_earned >= 1000 then 'silver'
      else 'bronze'
    end
    where user_id = new.user_id;
  end if;

  return new;
end;
$function$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. cancel-booking writes 'partially_refunded' on a partial refund, and the
--    CHECK constraint did not allow it — so the UPDATE threw 23514 AFTER the
--    Stripe refund had already gone out, leaving money returned to the renter
--    against a booking still marked paid and active. 'processing' is allowed
--    too: create-booking's double-sale guard already treats it as holding
--    inventory, so a value it reasons about must be a value the column accepts.
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.rentivo_bookings
  drop constraint if exists rentivo_bookings_payment_status_check;
alter table public.rentivo_bookings
  add constraint rentivo_bookings_payment_status_check
  check (payment_status in ('pending','processing','paid','failed','refunded','partially_refunded'));

alter table public.rentivo_bookings
  drop constraint if exists rentivo_bookings_contract_status_check;
alter table public.rentivo_bookings
  add constraint rentivo_bookings_contract_status_check
  check (contract_status is null or contract_status in ('pending','guest_signed','operator_signed','fully_signed'));

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. A renter could extend their own paid rental for free.
--
-- `authenticated` holds UPDATE on start_date, end_date, total_days, listing_id,
-- operator_id, user_id, pickup_damage_done, return_damage_done and
-- has_damage_claim, the update policy has no column restriction, and the write
-- guard only covered money, status transitions and signatures. A renter could
-- PATCH end_date a fortnight later on a paid booking, and flip the flags that
-- gate the damage screens on both sides.
-- ═══════════════════════════════════════════════════════════════════════════
revoke update (
  start_date, end_date, total_days, total_hours, rental_type,
  listing_id, operator_id, host_id, user_id, owner_type,
  pickup_damage_done, return_damage_done, has_damage_claim,
  contract_status, contract_url, contract_html,
  guest_signed_at, operator_signed_at, contract_signed_at
) on public.rentivo_bookings from authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Two inspections of the same type on one booking make the evidence
--    unreadable: fetchDamageReport reads (booking_id, type) and two rows answer
--    as "no report", so the operator sees "Not filed" with no baseline photos
--    while the done-flag says otherwise. The client guards this, but not two
--    submissions in flight at once.
-- ═══════════════════════════════════════════════════════════════════════════
create unique index if not exists rentivo_damage_reports_booking_type_uniq
  on public.rentivo_damage_reports (booking_id, type);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. The admin dashboard counts bookings and sums revenue against a table with
--    no admin SELECT policy: both queries succeeded, returned nothing, and the
--    tiles read 0 and EUR 0 regardless of turnover. Same for deactivated
--    operators, which an admin could not see at all.
-- ═══════════════════════════════════════════════════════════════════════════
drop policy if exists "Admins read bookings" on public.rentivo_bookings;
create policy "Admins read bookings"
  on public.rentivo_bookings for select
  using (public.rentivo_is_admin());

drop policy if exists "Admins read operators" on public.rentivo_operators;
create policy "Admins read operators"
  on public.rentivo_operators for select
  using (public.rentivo_is_admin());

-- 6. Privileged columns should not be insertable either. Unreachable today only
--    because a trigger pre-creates the profile row; that is a coincidence, not a
--    control.
revoke insert (is_admin, is_banned, role, is_verified, identity_status)
  on public.rentivo_users from authenticated, anon;
