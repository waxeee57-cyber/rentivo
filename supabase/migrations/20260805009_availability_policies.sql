-- rentivo_availability had RLS ENABLED and NOT ONE POLICY. With RLS on and no
-- policy, every client read returns zero rows and every client write is denied,
-- silently. Consequences, all live:
--   * The consumer date picker shows every date as free, including sold ones.
--   * The operator's blackout-dates screen cannot display or save anything.
--   * A paid booking's block was invisible to both sides. Only create-booking
--     and the Stripe webhook saw it, because they run on the service role.
--
-- Found by an end-to-end test, not by reading code: the test asserted the block
-- existed, read it with a traveler's token, and got an empty array. The row was
-- there. The read was blind.
--
-- Public read is deliberate: a rental marketplace cannot let someone pick dates
-- without telling them which ones are taken, and this table holds no personal
-- data (dates and a reason, no guest). That is a narrower disclosure than the
-- bulk iCal feed, which stays behind a per-listing token.
create policy "Anyone reads blocked dates"
  on public.rentivo_availability for select
  using (true);

create policy "Operators manage own blackouts"
  on public.rentivo_availability for all
  using (exists (
    select 1 from public.rentivo_listings l
    join public.rentivo_operators o on o.id = l.operator_id
    where l.id = rentivo_availability.listing_id and o.auth_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.rentivo_listings l
    join public.rentivo_operators o on o.id = l.operator_id
    where l.id = rentivo_availability.listing_id and o.auth_id = (select auth.uid())
  ));

create policy "Hosts manage own blackouts"
  on public.rentivo_availability for all
  using (exists (
    select 1 from public.rentivo_listings l
    join public.rentivo_hosts h on h.id = l.host_id
    where l.id = rentivo_availability.listing_id and h.auth_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.rentivo_listings l
    join public.rentivo_hosts h on h.id = l.host_id
    where l.id = rentivo_availability.listing_id and h.auth_id = (select auth.uid())
  ));

-- An owner may blackout dates, but must not hand-delete the block that a PAID
-- booking put there: that is how a sold vehicle becomes bookable again.
-- cancel-booking (service role) is the only path that clears those.
revoke delete on public.rentivo_availability from authenticated, anon;
revoke insert, update, delete on public.rentivo_availability from anon;
