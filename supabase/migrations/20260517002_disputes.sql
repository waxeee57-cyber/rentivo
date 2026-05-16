CREATE TABLE IF NOT EXISTS rentivo_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES rentivo_bookings(id),
  raised_by_auth_id uuid NOT NULL REFERENCES auth.users(id),
  raised_by_role text NOT NULL CHECK (raised_by_role IN ('consumer', 'operator', 'host')),
  reason text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'closed')),
  resolution text,
  resolved_by_auth_id uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rentivo_disputes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rentivo_disputes' AND policyname='disputes_select') THEN
    CREATE POLICY disputes_select ON rentivo_disputes FOR SELECT USING (
      raised_by_auth_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM rentivo_bookings b
        JOIN rentivo_operators o ON o.id = b.operator_id
        WHERE b.id = booking_id AND o.auth_id = auth.uid()
      )
      OR EXISTS (SELECT 1 FROM rentivo_users WHERE auth_id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rentivo_disputes' AND policyname='disputes_insert') THEN
    CREATE POLICY disputes_insert ON rentivo_disputes FOR INSERT WITH CHECK (
      raised_by_auth_id = auth.uid()
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rentivo_disputes' AND policyname='disputes_update') THEN
    CREATE POLICY disputes_update ON rentivo_disputes FOR UPDATE USING (
      EXISTS (SELECT 1 FROM rentivo_users WHERE auth_id = auth.uid() AND is_admin = true)
    );
  END IF;
END $$;
