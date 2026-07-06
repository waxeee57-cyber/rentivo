-- 20260706001_seed_host_villa_sol.sql
-- Data-truth seed: create ONE host bound to the confirmed test user and link the
-- orphaned Villa Sol listing (owner_type=host, host_id was NULL) to it.
-- stripe_onboarded stays false on purpose — Connect must remain blocked so the
-- pre-payment integration test can assert the "owner not set up" 400 gate.
-- Guarded so a re-apply never creates duplicate host rows.

WITH new_host AS (
  INSERT INTO public.rentivo_hosts (auth_id, name, city, country, email, stripe_onboarded)
  SELECT '6f02c5a9-eff1-41a0-bf1f-257048775769', 'Villa Sol Host', 'Budapest', 'HU', 'waxeee57@gmail.com', false
  WHERE NOT EXISTS (
    SELECT 1 FROM public.rentivo_hosts WHERE auth_id = '6f02c5a9-eff1-41a0-bf1f-257048775769'
  )
  RETURNING id
)
UPDATE public.rentivo_listings l
SET host_id = COALESCE(
      (SELECT id FROM new_host),
      (SELECT id FROM public.rentivo_hosts WHERE auth_id = '6f02c5a9-eff1-41a0-bf1f-257048775769' ORDER BY created_at LIMIT 1)
    ),
    owner_type = 'host'
WHERE l.id = '0c082a08-d3c0-453b-bc5c-36a0eb413870';
