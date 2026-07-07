-- ============================================================================
-- DRAFT — NOT APPLIED.  Listings self-create RLS + owner/tenant guard.
-- Part of the (1) self-service plan (see plan-self-service-onboarding.md).
-- Rev 2 (2026-06-24): hardened after adversarial review — see "ADVERSARIAL" below.
--
-- WARNING: do NOT place in supabase/migrations/ and do NOT `supabase db push`
--   (would also apply the GATED 20260624003_bookings_revoke_financial_insert.sql).
--   Apply STANDALONE via the Supabase SQL editor (superuser) or MCP apply_migration,
--   and verify BEFORE shipping the client listing-create changes.
--
-- PROBLEM [REPO] 03_listings.sql:50-57 — the only listings policies are keyed on
--   owner_user_id; the sole INSERT-capable one is the FOR ALL "Owners manage own
--   listings". App createListing sets operator_id/host_id, leaves owner_user_id NULL
--   ([REPO] lib/api/listings.ts:63-72; fleet/new.tsx:86-113; host new.tsx:117-147),
--   so self-create is rejected and operator/host fleet mgmt cannot see/edit rows.
--
-- SECURITY MODEL — owner/tenant identity is the SERVER's, never the client's:
--   (1) BEFORE INSERT: trigger stamps owner_user_id := auth.uid() (ignores client).
--   (2) INSERT WITH CHECK: exactly one of operator_id/host_id, owner_type matches it,
--       and that operator/host is owned by auth.uid() (auth_id = auth.uid())
--       → no cross-tenant create.
--   (3) BEFORE UPDATE: the owner/tenant columns (owner_user_id, operator_id, host_id,
--       owner_type) are FROZEN for non-service callers → no cross-tenant re-pointing,
--       no owner_user_id spoof/handoff, no XOR/owner_type desync. Other columns
--       (price, title, available, photos, ...) remain freely owner-manageable.
--
-- ADVERSARIAL (rev1 → rev2): a 3-lens skeptic pass found rev1's UPDATE path holed —
--   the UPDATE WITH CHECK was an OR of independent ownership proofs, so a legit owner
--   could (HIGH) re-point operator_id/host_id+owner_type to a FOREIGN tenant while the
--   owner_user_id branch passed (payout/liability transfer), (MED) spoof owner_user_id
--   onto a victim, (LOW) desync owner_type. rev2 closes all three by freezing those
--   columns on UPDATE in the guard trigger. Orphan/foreign rows were confirmed NOT
--   update/deletable (every USING branch false for non-owners) — unchanged in rev2.
-- ============================================================================

-- 1) Owner/tenant guard: stamp on INSERT, freeze on UPDATE. Service-role / superuser
--    (auth.uid() IS NULL) bypass entirely so seed + edge-function writes still work.
create or replace function public.rentivo_listings_guard_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;  -- service_role (edge/webhook) + superuser (migrations/seed) bypass
  end if;

  if tg_op = 'INSERT' then
    new.owner_user_id := auth.uid();  -- authoritative; ignore any client-supplied value
  elsif tg_op = 'UPDATE' then
    if new.owner_user_id is distinct from old.owner_user_id
       or new.operator_id is distinct from old.operator_id
       or new.host_id     is distinct from old.host_id
       or new.owner_type  is distinct from old.owner_type
    then
      raise exception
        'rentivo_listings: owner/tenant columns (owner_user_id, operator_id, host_id, owner_type) are server-only and immutable after creation. User % attempted a forbidden change.', auth.uid()
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists rentivo_listings_set_owner   on public.rentivo_listings;  -- rev1 name
drop trigger if exists rentivo_listings_guard_owner on public.rentivo_listings;
create trigger rentivo_listings_guard_owner
  before insert or update on public.rentivo_listings
  for each row execute function public.rentivo_listings_guard_owner();

-- Trigger fn must not be directly /rpc/-callable (mirrors the bookings guard pattern).
revoke execute on function public.rentivo_listings_guard_owner() from public, anon, authenticated;

-- 2) Replace the loose FOR ALL with explicit, ownership-validated policies.
drop policy if exists "Owners manage own listings" on public.rentivo_listings;

-- INSERT: owner_user_id is trigger-stamped to auth.uid(); exactly one owner kind,
-- owner_type matches it, and that operator/host is owned by the caller.
create policy "owners_insert_own_listings" on public.rentivo_listings
  for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and (
      (operator_id is not null and host_id is null and owner_type = 'operator'
        and exists (select 1 from public.rentivo_operators o
                    where o.id = operator_id and o.auth_id = auth.uid()))
      or
      (host_id is not null and operator_id is null and owner_type = 'host'
        and exists (select 1 from public.rentivo_hosts h
                    where h.id = host_id and h.auth_id = auth.uid()))
    )
  );

-- UPDATE / DELETE: only the owner (by owner_user_id, or by an owned operator/host).
-- The guard trigger above prevents the owner/tenant columns from changing on UPDATE,
-- so the WITH CHECK cannot be abused to re-point/spoof — it only re-affirms ownership.
create policy "owners_update_own_listings" on public.rentivo_listings
  for update to authenticated
  using (
    auth.uid() = owner_user_id
    or exists (select 1 from public.rentivo_operators o where o.id = operator_id and o.auth_id = auth.uid())
    or exists (select 1 from public.rentivo_hosts h where h.id = host_id and h.auth_id = auth.uid())
  )
  with check (
    auth.uid() = owner_user_id
    or exists (select 1 from public.rentivo_operators o where o.id = operator_id and o.auth_id = auth.uid())
    or exists (select 1 from public.rentivo_hosts h where h.id = host_id and h.auth_id = auth.uid())
  );

create policy "owners_delete_own_listings" on public.rentivo_listings
  for delete to authenticated
  using (
    auth.uid() = owner_user_id
    or exists (select 1 from public.rentivo_operators o where o.id = operator_id and o.auth_id = auth.uid())
    or exists (select 1 from public.rentivo_hosts h where h.id = host_id and h.auth_id = auth.uid())
  );

-- NOTE: "Anyone can view available listings" (available=true) and "Owners see own
--   listings" (auth.uid()=owner_user_id) stay as-is [REPO] 03_listings.sql:50-54.
--   Optionally extend the latter with the operator/host EXISTS clauses so owners see
--   their own UNAVAILABLE listings. RLS subqueries read the caller's OWN operator/host
--   row via existing self policies, so the EXISTS checks resolve under RLS.
--
-- DEFENSE-IN-DEPTH (optional, mirrors 20260624001 for operators/hosts): also
--   REVOKE UPDATE (owner_user_id, operator_id, host_id, owner_type)
--     ON public.rentivo_listings FROM authenticated;
--   The guard trigger already blocks these changes; the column REVOKE is belt-and-suspenders.
--
-- ORPHAN seed rows (owner_user_id NULL, operator_id NULL, host_id NULL) remain
--   non-manageable by any authenticated user (every USING branch false) — by design.
--   Adopt them, if needed, via a service_role/admin backfill, NOT by loosening USING.
--
-- VERIFY after apply (real JWT, like the payments dry-run):
--   * operator A inserts with operator_id=A, owner_type='operator' -> 201; row.owner_user_id = A.
--   * operator A inserts with operator_id=B (foreign) -> REJECTED (WITH CHECK).
--   * operator A inserts operator_id=A but owner_type='host' -> REJECTED (owner_type mismatch).
--   * client sending owner_user_id=<other> on insert -> overwritten to A by trigger.
--   * owner A UPDATE SET operator_id=B (or host_id, owner_type, owner_user_id) -> RAISES (frozen).
--   * owner A UPDATE SET price_per_day=... -> succeeds (non-owner columns mutable).
--   * non-owner / orphan UPDATE/DELETE -> 0 rows (USING false).
