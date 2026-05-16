-- Admin flag on users
ALTER TABLE rentivo_users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
ALTER TABLE rentivo_users ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;

-- Operator moderation fields
ALTER TABLE rentivo_operators ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT true;
ALTER TABLE rentivo_operators ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false;
ALTER TABLE rentivo_operators ADD COLUMN IF NOT EXISTS suspension_reason text;

-- Admin audit log
CREATE TABLE IF NOT EXISTS rentivo_admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_auth_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  target_type text NOT NULL, -- 'user' | 'operator' | 'booking' | 'promo'
  target_id uuid NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rentivo_admin_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rentivo_admin_logs' AND policyname='admin_logs_policy') THEN
    CREATE POLICY admin_logs_policy ON rentivo_admin_logs
      FOR ALL USING (
        EXISTS (SELECT 1 FROM rentivo_users WHERE auth_id = auth.uid() AND is_admin = true)
      );
  END IF;
END $$;

-- Index for fast admin lookups
CREATE INDEX IF NOT EXISTS idx_rentivo_users_is_admin ON rentivo_users(is_admin) WHERE is_admin = true;
CREATE INDEX IF NOT EXISTS idx_rentivo_users_is_banned ON rentivo_users(is_banned) WHERE is_banned = true;
CREATE INDEX IF NOT EXISTS idx_rentivo_operators_suspended ON rentivo_operators(suspended) WHERE suspended = true;
CREATE INDEX IF NOT EXISTS idx_rentivo_admin_logs_admin_auth_id ON rentivo_admin_logs(admin_auth_id);
CREATE INDEX IF NOT EXISTS idx_rentivo_admin_logs_target_id ON rentivo_admin_logs(target_id);
