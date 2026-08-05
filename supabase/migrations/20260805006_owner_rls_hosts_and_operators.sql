-- ═══════════════════════════════════════════════════════════════════════════
-- Ownership policies that match how ownership is actually stored.
--
-- rentivo_listings had exactly one owner policy:
--     "Owners manage own listings"  FOR ALL  USING (auth.uid() = owner_user_id)
--
-- `owner_user_id` is NULL on every row in this database. Ownership is recorded
-- as `operator_id -> rentivo_operators.auth_id` or `host_id -> rentivo_hosts.auth_id`.
-- Consequences, all of them live today:
--   * No operator and no host can UPDATE a listing (edit screen, pause toggle,
--     price change) - the UPDATE matches zero rows.
--   * A FOR ALL policy with no WITH CHECK reuses its USING clause on INSERT, so
--     creating a listing from the app fails too unless owner_user_id is set to
--     the caller, which no screen does.
--   * `available = false` listings are invisible to their own owner, because the
--     only other SELECT policy is `available = true`. Pausing a vehicle made it
--     disappear from the owner's own fleet.
--
-- rentivo_bookings had no host SELECT policy at all, only operator and traveler,
-- so a host could not read a single one of their own bookings. Every earnings
-- figure on the host dashboard was summing an empty array.
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists "Owners manage own listings" on public.rentivo_listings;

create policy "Direct owners manage own listings"
  on public.rentivo_listings for all
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

create policy "Operators manage own listings"
  on public.rentivo_listings for all
  using (exists (
    select 1 from public.rentivo_operators o
    where o.id = rentivo_listings.operator_id and o.auth_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.rentivo_operators o
    where o.id = rentivo_listings.operator_id and o.auth_id = (select auth.uid())
  ));

create policy "Hosts manage own listings"
  on public.rentivo_listings for all
  using (exists (
    select 1 from public.rentivo_hosts h
    where h.id = rentivo_listings.host_id and h.auth_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.rentivo_hosts h
    where h.id = rentivo_listings.host_id and h.auth_id = (select auth.uid())
  ));

create policy "Hosts see own listing bookings"
  on public.rentivo_bookings for select
  using (exists (
    select 1 from public.rentivo_hosts h
    where h.id = rentivo_bookings.host_id and h.auth_id = (select auth.uid())
  ));

-- ── Host conversations.
-- rentivo_conversations models exactly two participants: a traveler and an
-- operator. operator_id is NOT NULL and there is no host column, so a host
-- conversation cannot be inserted, let alone read. The host inbox screen could
-- never have shown anything.
alter table public.rentivo_conversations
  add column if not exists host_id uuid references public.rentivo_hosts(id) on delete cascade;

alter table public.rentivo_conversations
  alter column operator_id drop not null;

create index if not exists rentivo_conversations_host_id_idx
  on public.rentivo_conversations (host_id);

-- Exactly one owner side, so a conversation cannot belong to both.
alter table public.rentivo_conversations
  drop constraint if exists rentivo_conversations_one_owner;
alter table public.rentivo_conversations
  add constraint rentivo_conversations_one_owner
  check (num_nonnulls(operator_id, host_id) = 1);

drop policy if exists conv_participant_read on public.rentivo_conversations;
create policy conv_participant_read
  on public.rentivo_conversations for select
  using (
    (select auth.uid()) = user_id
    or (select auth.uid()) = operator_user_id
    or exists (select 1 from public.rentivo_operators o
               where o.id = rentivo_conversations.operator_id and o.auth_id = (select auth.uid()))
    or exists (select 1 from public.rentivo_hosts h
               where h.id = rentivo_conversations.host_id and h.auth_id = (select auth.uid()))
  );

drop policy if exists conv_participant_update on public.rentivo_conversations;
create policy conv_participant_update
  on public.rentivo_conversations for update
  using (
    (select auth.uid()) = user_id
    or (select auth.uid()) = operator_user_id
    or exists (select 1 from public.rentivo_operators o
               where o.id = rentivo_conversations.operator_id and o.auth_id = (select auth.uid()))
    or exists (select 1 from public.rentivo_hosts h
               where h.id = rentivo_conversations.host_id and h.auth_id = (select auth.uid()))
  )
  with check (
    (select auth.uid()) = user_id
    or (select auth.uid()) = operator_user_id
    or exists (select 1 from public.rentivo_operators o
               where o.id = rentivo_conversations.operator_id and o.auth_id = (select auth.uid()))
    or exists (select 1 from public.rentivo_hosts h
               where h.id = rentivo_conversations.host_id and h.auth_id = (select auth.uid()))
  );
