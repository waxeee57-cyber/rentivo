-- Stripe redelivers webhook events on any non-2xx and on its own schedule.
-- Without a record of what has already been handled, every redelivery re-ran
-- every handler: re-confirming bookings, re-charging deposit state, and
-- re-writing paid_at. This table is the idempotency key store.
--
-- Written by the webhook ONLY after its handler succeeded, so a failed handler
-- is still retried by Stripe.
create table if not exists public.rentivo_stripe_events (
  id          text primary key,
  type        text not null,
  received_at timestamptz not null default now()
);

create index if not exists rentivo_stripe_events_received_at_idx
  on public.rentivo_stripe_events (received_at);

-- Service role only. No policies are defined, so with RLS enabled every
-- anon/authenticated request sees an empty table and can write nothing.
alter table public.rentivo_stripe_events enable row level security;

revoke all on public.rentivo_stripe_events from anon, authenticated;
