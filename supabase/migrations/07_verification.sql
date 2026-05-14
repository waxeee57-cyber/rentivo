ALTER TABLE rentivo_users
  ADD COLUMN IF NOT EXISTS verification_status text
  NOT NULL DEFAULT 'unverified'
  CHECK (verification_status IN ('unverified','pending','verified','rejected'));

ALTER TABLE rentivo_users
  ADD COLUMN IF NOT EXISTS license_front_url text,
  ADD COLUMN IF NOT EXISTS license_back_url text,
  ADD COLUMN IF NOT EXISTS selfie_url text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;
