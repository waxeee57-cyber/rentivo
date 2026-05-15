-- EU STR Regulation 2024/1028
ALTER TABLE public.rentivo_listings
  ADD COLUMN IF NOT EXISTS str_registration_number TEXT;
COMMENT ON COLUMN public.rentivo_listings.str_registration_number IS 'EU STR Regulation 2024/1028 — Rövid távú bérlési regisztrációs szám. Kötelező villa/apartman kategóriáknál.';
