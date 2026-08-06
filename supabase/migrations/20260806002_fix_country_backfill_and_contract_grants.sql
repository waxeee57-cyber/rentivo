-- ═══════════════════════════════════════════════════════════════════════════
-- 1. The stripe_account_country backfill guessed, and guessed wrong.
--
-- It stamped 'HU' on every row holding a stripe_account_id, on the theory that
-- all existing accounts predated the country fix. Accounts created AFTER it
-- carry their own country, so the mismatch guard correctly fired 409
-- stripe_country_mismatch on an operator whose Stripe account was never
-- Hungarian, and blocked their onboarding entirely. The guard was right; the
-- data was wrong. Verified against Stripe: acct_1Tqc56ER42YjEKEJ is genuinely
-- HU, acct_1U1FxsCzKqB3lSb1 is ES.
-- ═══════════════════════════════════════════════════════════════════════════
update public.rentivo_operators set stripe_account_country = 'ES'
 where stripe_account_id = 'acct_1U1FxsCzKqB3lSb1';
update public.rentivo_hosts set stripe_account_country = 'ES'
 where stripe_account_id = 'acct_1U1FxsCzKqB3lSb1';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Revoking UPDATE on the contract columns was my own regression.
--
-- Locking start_date and the damage flags away from the renter was right. The
-- same statement also revoked contract_status, contract_url, contract_html and
-- the three signed_at stamps, and the signature screens are exactly what writes
-- those: both parties started getting 403 and no contract could be signed at
-- all. 40 assertions in the contract suite went from passing to failing.
--
-- The grants come back, and the RULE moves into the trigger where it belongs:
-- these are append-only. A party may record their own signature and its
-- timestamp once; nobody may rewrite or erase what the other side signed.
-- ═══════════════════════════════════════════════════════════════════════════
grant update (
  contract_status, contract_url, contract_html,
  guest_signed_at, operator_signed_at, contract_signed_at
) on public.rentivo_bookings to authenticated;

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

  if new.total_amount is distinct from old.total_amount
     or new.subtotal is distinct from old.subtotal
     or new.platform_fee is distinct from old.platform_fee
     or new.payment_status is distinct from old.payment_status
     or new.paid_at is distinct from old.paid_at
     or new.payment_intent_id is distinct from old.payment_intent_id
     or new.stripe_charge_id is distinct from old.stripe_charge_id
     or new.refund_amount is distinct from old.refund_amount
     or new.refund_id is distinct from old.refund_id
     or new.deposit_status is distinct from old.deposit_status
     or new.deposit_charged_amount is distinct from old.deposit_charged_amount
  then
    raise exception 'Payment fields on a booking are server-owned'
      using errcode = 'insufficient_privilege';
  end if;

  if new.status is distinct from old.status then
    if is_traveler then
      raise exception 'A traveler cannot change booking status directly'
        using errcode = 'insufficient_privilege';
    end if;
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

  -- Signatures and their timestamps are evidence: recorded once, never edited.
  if old.consumer_signature is not null
     and new.consumer_signature is distinct from old.consumer_signature then
    raise exception 'The renter signature is already recorded' using errcode = 'insufficient_privilege';
  end if;
  if old.operator_signature is not null
     and new.operator_signature is distinct from old.operator_signature then
    raise exception 'The owner signature is already recorded' using errcode = 'insufficient_privilege';
  end if;
  if old.guest_signature is not null
     and new.guest_signature is distinct from old.guest_signature then
    raise exception 'The guest signature is already recorded' using errcode = 'insufficient_privilege';
  end if;
  if old.operator_signature_data is not null
     and new.operator_signature_data is distinct from old.operator_signature_data then
    raise exception 'The owner signature is already recorded' using errcode = 'insufficient_privilege';
  end if;
  if old.guest_signed_at is not null
     and new.guest_signed_at is distinct from old.guest_signed_at then
    raise exception 'The guest signing time is already recorded' using errcode = 'insufficient_privilege';
  end if;
  if old.operator_signed_at is not null
     and new.operator_signed_at is distinct from old.operator_signed_at then
    raise exception 'The owner signing time is already recorded' using errcode = 'insufficient_privilege';
  end if;

  -- A signed contract is not re-writable either. Before both signatures exist it
  -- may still be regenerated, which is what the signing screens do.
  if old.contract_status = 'fully_signed'
     and (new.contract_url is distinct from old.contract_url
          or new.contract_html is distinct from old.contract_html
          or new.contract_status is distinct from old.contract_status) then
    raise exception 'A fully signed contract cannot be altered' using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;
