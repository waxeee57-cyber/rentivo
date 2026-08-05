-- The admin screen (app/(admin)/promo-codes.tsx) selects, orders by, and writes
-- `is_active` on this table. The column never existed, so every query on that
-- screen failed and the "deactivate" button silently did nothing: a promo code,
-- once created, could not be switched off. create-booking also never checked it.
alter table public.rentivo_promo_codes
  add column if not exists is_active boolean not null default true;

create index if not exists rentivo_promo_codes_active_code_idx
  on public.rentivo_promo_codes (code) where is_active;
