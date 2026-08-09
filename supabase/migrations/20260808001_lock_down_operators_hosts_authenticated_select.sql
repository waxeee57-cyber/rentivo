-- Close the "authenticated-horizontal" residual from the operators/hosts leak
-- (tracked as open in docs/audits/AUDIT-2026-08-06.md #1, repeated in the
-- 2026-08-08 launch audit finding #3).
--
-- 20260806013 revoked SELECT on the base tables from `anon` and pointed
-- storefront reads at the rentivo_operators_public / rentivo_hosts_public
-- views instead. It deliberately left `authenticated` with base-table
-- SELECT, because the owner dashboard (own row), admin moderation, and the
-- digital contract generator (a traveler reading the operator/host they
-- actually booked with) all legitimately need it -- but the policy that
-- granted that, "Anyone can view active operators" / "public_read_hosts",
-- has no row filter beyond active = true, so it also handed ANY signed-in
-- stranger every column of every other active operator/host:
-- stripe_account_id, email, phone, push_token, suspension_reason, auth_id
-- (host's internal auth.users id), etc. That is the hole this closes.
--
-- New rule for authenticated SELECT on the base tables: own row, OR admin
-- (public.rentivo_is_admin(), same function/pattern as 20260805008), OR the
-- caller is the traveler on a booking that references this operator/host
-- row. Nobody else -- the public/marketing surface stays the _public views.

drop policy if exists "Anyone can view active operators" on public.rentivo_operators;

create policy "Admins read operators"
  on public.rentivo_operators for select
  to authenticated
  using (public.rentivo_is_admin());

create policy "Booking counterparty reads operator"
  on public.rentivo_operators for select
  to authenticated
  using (
    auth.uid() = auth_id
    or exists (
      select 1 from public.rentivo_bookings b
      where b.operator_id = rentivo_operators.id
        and b.user_id = auth.uid()
    )
  );

drop policy if exists "public_read_hosts" on public.rentivo_hosts;

create policy "Admins read hosts"
  on public.rentivo_hosts for select
  to authenticated
  using (public.rentivo_is_admin());

create policy "Booking counterparty reads host"
  on public.rentivo_hosts for select
  to authenticated
  using (
    auth.uid() = auth_id
    or exists (
      select 1 from public.rentivo_bookings b
      where b.host_id = rentivo_hosts.id
        and b.user_id = auth.uid()
    )
  );

comment on policy "Booking counterparty reads operator" on public.rentivo_operators is
  'Lets a traveler read the operator row for a listing they actually booked (contract generation, in-booking contact info, chat push lookup). Does NOT let an unrelated signed-in user read another operator base row -- use rentivo_operators_public for storefront/marketing reads.';

comment on policy "Booking counterparty reads host" on public.rentivo_hosts is
  'Same rule as rentivo_operators, mirrored for C2C hosts.';

-- 20260806011 left a PRE-LAUNCH SECURITY TODO comment on both tables
-- describing this exact residual (anon leak already closed by 013;
-- authenticated-horizontal closed by this migration). Update it so anyone
-- reading `\d+` / the dashboard schema view sees the current, accurate
-- state instead of a stale open finding.
comment on table public.rentivo_operators is
  'Operator (fleet manager) profiles. SELECT is row-scoped: own row, admin '
  '(rentivo_is_admin()), or a traveler with a booking against this operator. '
  'Storefront/marketing reads MUST use rentivo_operators_public, never this '
  'table. Fixed 2026-08-08, see 20260808001 -- prior finding in '
  '20260806011 is resolved.';

comment on table public.rentivo_hosts is
  'C2C host profiles. Same row-scoped SELECT rule as rentivo_operators -- '
  'own row, admin, or a traveler with a booking against this host. '
  'Storefront/marketing reads MUST use rentivo_hosts_public. Fixed '
  '2026-08-08, see 20260808001 -- prior finding in 20260806011 is resolved.';
