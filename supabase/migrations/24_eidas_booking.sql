-- eIDAS signature tracking for bookings
ALTER TABLE public.rentivo_bookings
  ADD COLUMN IF NOT EXISTS eidas_signature_level TEXT DEFAULT 'simple'
    CHECK (eidas_signature_level IN ('simple','advanced','qualified')),
  ADD COLUMN IF NOT EXISTS terms_version_accepted TEXT DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS cancellation_policy_accepted TEXT;
COMMENT ON COLUMN public.rentivo_bookings.eidas_signature_level IS 'eIDAS aláírási szint. Simple: alapértelmezett, jogilag érvényes EU-ban.';
