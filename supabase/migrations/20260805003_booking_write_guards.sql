-- ═══════════════════════════════════════════════════════════════════════════
-- Booking write guards.
--
-- Three holes, all in the same place:
--
--  1. `anon` still held INSERT/UPDATE on every money column (total_amount,
--     subtotal, platform_fee, payment_status, paid_at, payment_intent_id,
--     refund_amount, refund_id, stripe_charge_id, status, deposit_status). An
--     earlier hardening pass revoked these from `authenticated` and left `anon`
--     untouched. RLS happens to block anon today because every booking policy
--     keys off auth.uid(); that is one policy edit away from being a hole, and
--     a grant nobody needs should not be sitting there waiting.
--
--  2. `authenticated` kept UPDATE on `status`, and the UPDATE policy has no
--     WITH CHECK, so Postgres reuses its USING clause: a traveler could PATCH
--     their own unpaid booking to status='confirmed' and turn up at the counter
--     with a booking the operator app displays as confirmed. Nothing in the
--     client does this; nothing stopped a curl either.
--
--  3. Hosts were missing from the UPDATE policy entirely (it only knew about
--     rentivo_operators), so a host confirming a booking silently changed zero
--     rows. That was invisible until updateBookingStatus started throwing on an
--     empty result.
--
-- Signatures are also append-only from here on: consumer_signature and
-- operator_signature were plain updatable text, so either party could overwrite
-- the other's signature on a signed rental contract.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Take the write grants away from anon. Bookings are never written by an
--       unauthenticated client; guest bookings go through an edge function on
--       the service role.
revoke insert, update on public.rentivo_bookings from anon;

-- ── 2. Server-owned columns: no client role may write them, authenticated
--       included. create-booking / create-payment-intent / stripe-webhook /
--       cancel-booking all run on the service role and bypass column grants.
revoke update (
  total_amount, subtotal, platform_fee, price_per_day, deposit_amount,
  payment_status, paid_at, payment_intent_id, stripe_charge_id,
  refund_amount, refund_id, cancelled_at,
  deposit_status, deposit_charged_amount, deposit_setup_intent_id,
  deposit_payment_method_id,
  promo_code, promo_discount, identity_verified
) on public.rentivo_bookings from authenticated;

-- ── 3. The UPDATE policy, rewritten to include hosts.
drop policy if exists "Booking parties update status" on public.rentivo_bookings;

create policy "Booking parties update status"
  on public.rentivo_bookings
  for update
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.rentivo_operators o
      where o.id = rentivo_bookings.operator_id and o.auth_id = (select auth.uid())
    )
    or exists (
      select 1 from public.rentivo_hosts h
      where h.id = rentivo_bookings.host_id and h.auth_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.rentivo_operators o
      where o.id = rentivo_bookings.operator_id and o.auth_id = (select auth.uid())
    )
    or exists (
      select 1 from public.rentivo_hosts h
      where h.id = rentivo_bookings.host_id and h.auth_id = (select auth.uid())
    )
  );

-- ── 4. What RLS cannot express: OLD vs NEW.
--
-- SECURITY INVOKER on purpose. PostgREST does SET LOCAL ROLE, so current_user is
-- the request's role here; a SECURITY DEFINER function would report its owner
-- instead and every request would look like the service role.
create or replace function public.rentivo_bookings_write_guard()
returns trigger
language plpgsql
as $$
declare
  is_server boolean := current_user in ('service_role', 'postgres', 'supabase_admin');
  is_traveler boolean := (select auth.uid()) is not distinct from old.user_id;
begin
  if is_server then
    return new;
  end if;

  -- Money and Stripe identity are server truth. The column revokes above already
  -- reject these; this catches anything granted back by a later migration.
  if new.total_amount    is distinct from old.total_amount
     or new.subtotal        is distinct from old.subtotal
     or new.platform_fee    is distinct from old.platform_fee
     or new.payment_status  is distinct from old.payment_status
     or new.paid_at         is distinct from old.paid_at
     or new.payment_intent_id is distinct from old.payment_intent_id
     or new.stripe_charge_id  is distinct from old.stripe_charge_id
     or new.refund_amount     is distinct from old.refund_amount
     or new.refund_id         is distinct from old.refund_id
     or new.deposit_status    is distinct from old.deposit_status
     or new.deposit_charged_amount is distinct from old.deposit_charged_amount
  then
    raise exception 'Payment fields on a booking are server-owned'
      using errcode = 'insufficient_privilege';
  end if;

  if new.status is distinct from old.status then
    -- The traveler cancels through the cancel-booking function (which issues the
    -- refund); they have no other business changing a status.
    if is_traveler then
      raise exception 'A traveler cannot change booking status directly'
        using errcode = 'insufficient_privilege';
    end if;

    -- 'cancelled' means money moves. Only cancel-booking may write it.
    if new.status = 'cancelled' then
      raise exception 'Cancelling must go through the cancel-booking function'
        using errcode = 'insufficient_privilege';
    end if;

    if not (
      (old.status = 'pending'   and new.status = 'confirmed')
      or (old.status = 'confirmed' and new.status in ('active', 'completed'))
      or (old.status = 'active'    and new.status = 'completed')
    ) then
      raise exception 'Illegal booking status transition: % -> %', old.status, new.status
        using errcode = 'check_violation';
    end if;
  end if;

  -- Signatures are evidence. Once recorded they are not editable by a client;
  -- both parties could previously overwrite the other's signature.
  if old.consumer_signature is not null
     and new.consumer_signature is distinct from old.consumer_signature then
    raise exception 'The renter signature is already recorded'
      using errcode = 'insufficient_privilege';
  end if;
  if old.operator_signature is not null
     and new.operator_signature is distinct from old.operator_signature then
    raise exception 'The owner signature is already recorded'
      using errcode = 'insufficient_privilege';
  end if;
  if old.guest_signature is not null
     and new.guest_signature is distinct from old.guest_signature then
    raise exception 'The guest signature is already recorded'
      using errcode = 'insufficient_privilege';
  end if;
  if old.operator_signature_data is not null
     and new.operator_signature_data is distinct from old.operator_signature_data then
    raise exception 'The owner signature is already recorded'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists rentivo_bookings_write_guard on public.rentivo_bookings;
create trigger rentivo_bookings_write_guard
  before update on public.rentivo_bookings
  for each row execute function public.rentivo_bookings_write_guard();
