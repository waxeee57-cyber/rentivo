-- ════════════════════════════════════════════════════════════════════════════
-- GATED — DO NOT APPLY until a mobile build using the create-booking edge function
-- is RELEASED and older client versions (which INSERT bookings directly with
-- client-computed money fields) are retired.
-- ════════════════════════════════════════════════════════════════════════════
-- Closes the booking-INSERT financial vector at the DB layer: a non-service caller
-- can no longer set any money column on rentivo_bookings. After create-booking is
-- the only write path, the renter never inserts a financial value at all.
--
-- Applying this BEFORE the released app uses create-booking would break booking
-- creation for every installed app version (they insert these columns directly).
-- The create-payment-intent v8 floor already secures the CHARGE in the meantime,
-- so this is a data-integrity hardening, not an urgent security gap.
--
-- ROLLBACK:
--   GRANT INSERT (total_amount, subtotal, platform_fee, price_per_day,
--                 deposit_amount, promo_discount, delivery_fee)
--     ON public.rentivo_bookings TO authenticated;
-- ════════════════════════════════════════════════════════════════════════════

REVOKE INSERT (total_amount, subtotal, platform_fee, price_per_day,
               deposit_amount, promo_discount, delivery_fee)
  ON public.rentivo_bookings FROM authenticated;
