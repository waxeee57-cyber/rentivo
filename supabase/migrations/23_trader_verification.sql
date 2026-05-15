-- DSA Article 30 — Trader traceability
ALTER TABLE public.rentivo_operators
  ADD COLUMN IF NOT EXISTS legal_name TEXT,
  ADD COLUMN IF NOT EXISTS vat_number TEXT,
  ADD COLUMN IF NOT EXISTS registration_number TEXT,
  ADD COLUMN IF NOT EXISTS registered_address TEXT,
  ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kyc_provider TEXT,
  ADD COLUMN IF NOT EXISTS kyc_reference_id TEXT;
COMMENT ON COLUMN public.rentivo_operators.legal_name IS 'DSA Article 30 — Jogi cégnév. Publikusan megjelenik a listingeken.';
COMMENT ON COLUMN public.rentivo_operators.vat_number IS 'EU VAT szám. DSA trader traceability.';
COMMENT ON COLUMN public.rentivo_operators.kyc_verified_at IS 'KYC ellenőrzés időpontja. DSA Article 30 kötelező azonosítás.';
