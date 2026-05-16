-- API Keys for operators
CREATE TABLE IF NOT EXISTS rentivo_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES rentivo_operators(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  last_used_at timestamptz,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rentivo_api_keys ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rentivo_api_keys' AND policyname='api_keys_policy') THEN
    CREATE POLICY api_keys_policy ON rentivo_api_keys FOR ALL USING (
      EXISTS (SELECT 1 FROM rentivo_operators WHERE id = operator_id AND auth_id = auth.uid())
    );
  END IF;
END $$;

-- Index on FK for RLS performance
CREATE INDEX IF NOT EXISTS rentivo_api_keys_operator_id_idx ON rentivo_api_keys(operator_id);

-- Webhook endpoints for operators
CREATE TABLE IF NOT EXISTS rentivo_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES rentivo_operators(id) ON DELETE CASCADE,
  url text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  secret text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  is_active boolean NOT NULL DEFAULT true,
  last_triggered_at timestamptz,
  failure_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rentivo_webhooks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rentivo_webhooks' AND policyname='webhooks_policy') THEN
    CREATE POLICY webhooks_policy ON rentivo_webhooks FOR ALL USING (
      EXISTS (SELECT 1 FROM rentivo_operators WHERE id = operator_id AND auth_id = auth.uid())
    );
  END IF;
END $$;

-- Index on FK for RLS performance
CREATE INDEX IF NOT EXISTS rentivo_webhooks_operator_id_idx ON rentivo_webhooks(operator_id);
