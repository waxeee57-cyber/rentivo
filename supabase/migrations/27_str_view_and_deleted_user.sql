-- 1. Deleted user placeholder for GDPR anonymization
-- Reviews keep their FK valid after user erasure — DELETED_USER_ID stays in auth.users
-- GDPR Art 17(3)(b): platform integrity — review content is legitimate interest
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, role
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'deleted@rentivo.internal',
  '',
  NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Deleted User"}'::jsonb,
  false,
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- 2. STR compliance view
-- FIX: category is TEXT (not enum) — no ::text cast needed
-- FIX: available = true (not status = 'active' — listings have no status column)
CREATE OR REPLACE VIEW public.str_compliance_status AS
SELECT
  id,
  title,
  category,
  pickup_address,
  str_registration_number,
  CASE
    WHEN category IN ('villa', 'apartment') AND str_registration_number IS NULL THEN 'missing'
    WHEN category IN ('villa', 'apartment') AND str_registration_number IS NOT NULL THEN 'compliant'
    ELSE 'not_required'
  END AS str_status
FROM public.rentivo_listings
WHERE available = true;

COMMENT ON VIEW public.str_compliance_status IS
  'EU STR Regulation 2024/1028. category TEXT — no cast. available=true gate.
   Csak villa/apartment esetén kötelező a str_registration_number.';
