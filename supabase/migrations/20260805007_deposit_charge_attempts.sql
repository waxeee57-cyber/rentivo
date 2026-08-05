-- charge-deposit used a FIXED Stripe idempotency key, `rentivo_dep_<booking_id>`,
-- and flipped deposit_status to 'charge_failed' on a decline while its own guard
-- required 'authorized'. Between the two, a booking got exactly ONE deposit
-- charge attempt for its entire life: a soft decline (insufficient funds, an
-- expired card, a 3DS challenge) was permanent, and the owner had no way to try
-- again after the renter fixed their card.
--
-- The counter makes the idempotency key attempt-scoped: two taps of the same
-- button still collapse into one charge (both read the same attempt number),
-- while a deliberate retry after a recorded failure gets a fresh key.
alter table public.rentivo_bookings
  add column if not exists deposit_charge_attempts integer not null default 0;

revoke update (deposit_charge_attempts) on public.rentivo_bookings from anon, authenticated;
