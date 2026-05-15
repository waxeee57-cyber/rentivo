-- Fix: add columns that Edge Functions reference but do not yet exist in schema
-- stripe-webhook references stripe_charge_id on rentivo_bookings
-- delete-account references email_hash on security_audit_log
-- ical-import references end_date on rentivo_availability

-- 1. rentivo_bookings.stripe_charge_id
--    The stripe-webhook function stores the Stripe charge ID (ch_...) after PaymentIntent.succeeded.
ALTER TABLE public.rentivo_bookings
  ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT;

-- 2. security_audit_log.email_hash
--    The delete-account function stores a SHA-256 hash of the user's email for GDPR audit trails.
--    NOT a foreign key — must survive auth.users deletion (GDPR Art 5(2) accountability).
ALTER TABLE public.security_audit_log
  ADD COLUMN IF NOT EXISTS email_hash TEXT;

-- 3. rentivo_availability.end_date
--    The ical-import function stores blocked date ranges from external iCal feeds.
--    blocked_date is the range start; end_date is the range end (exclusive, iCal convention).
ALTER TABLE public.rentivo_availability
  ADD COLUMN IF NOT EXISTS end_date DATE;

-- Index on end_date for range overlap queries
CREATE INDEX IF NOT EXISTS idx_availability_end_date
  ON public.rentivo_availability(listing_id, end_date)
  WHERE end_date IS NOT NULL;

COMMENT ON COLUMN public.rentivo_bookings.stripe_charge_id IS
  'Stripe charge ID (ch_...) set by stripe-webhook on payment_intent.succeeded.';

COMMENT ON COLUMN public.security_audit_log.email_hash IS
  'SHA-256 of user email — GDPR Art 5(2) accountability. No FK: survives user deletion.';

COMMENT ON COLUMN public.rentivo_availability.end_date IS
  'Range end date for iCal-imported blocks. NULL for single-day manual blocks.';
