CREATE TABLE IF NOT EXISTS rentivo_blackout_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES rentivo_listings(id) ON DELETE CASCADE,
  operator_id uuid NOT NULL REFERENCES rentivo_operators(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Unavailable',
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text CHECK (reason IN ('maintenance', 'personal_use', 'seasonal', 'other')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

ALTER TABLE rentivo_blackout_periods ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rentivo_blackout_periods' AND policyname='blackout_operator_policy') THEN
    CREATE POLICY blackout_operator_policy ON rentivo_blackout_periods FOR ALL USING (
      EXISTS (SELECT 1 FROM rentivo_operators WHERE id = operator_id AND auth_id = auth.uid())
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rentivo_blackout_periods' AND policyname='blackout_read_policy') THEN
    CREATE POLICY blackout_read_policy ON rentivo_blackout_periods FOR SELECT USING (true);
  END IF;
END $$;
