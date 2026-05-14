-- Host type for private individuals (C2C)
CREATE TABLE IF NOT EXISTS rentivo_hosts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id             uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name                text NOT NULL,
  bio                 text,
  avatar_url          text,
  phone               text,
  email               text,
  city                text NOT NULL,
  country             text NOT NULL DEFAULT 'HU',
  rating              numeric(3,2) DEFAULT 0,
  review_count        integer NOT NULL DEFAULT 0,
  verified            boolean NOT NULL DEFAULT false,
  identity_verified   boolean NOT NULL DEFAULT false,
  stripe_account_id   text,
  stripe_onboarded    boolean NOT NULL DEFAULT false,
  response_rate       integer DEFAULT 100,
  response_time       text DEFAULT '1 hour',
  member_since        timestamptz NOT NULL DEFAULT now(),
  total_rentals       integer NOT NULL DEFAULT 0,
  active              boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Add host support to listings
ALTER TABLE rentivo_listings
  ADD COLUMN IF NOT EXISTS owner_type text NOT NULL DEFAULT 'operator'
    CHECK (owner_type IN ('operator', 'host')),
  ADD COLUMN IF NOT EXISTS host_id uuid REFERENCES rentivo_hosts(id),
  ADD COLUMN IF NOT EXISTS instant_book boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancellation_policy text NOT NULL DEFAULT 'moderate'
    CHECK (cancellation_policy IN ('flexible','moderate','strict'));

-- Add host support to bookings
ALTER TABLE rentivo_bookings
  ADD COLUMN IF NOT EXISTS host_id uuid REFERENCES rentivo_hosts(id),
  ADD COLUMN IF NOT EXISTS owner_type text NOT NULL DEFAULT 'operator'
    CHECK (owner_type IN ('operator','host'));

-- RLS for hosts
ALTER TABLE rentivo_hosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_hosts" ON rentivo_hosts
  FOR SELECT TO anon, authenticated USING (active = true);

CREATE POLICY "hosts_own_profile" ON rentivo_hosts
  FOR ALL TO authenticated
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());
