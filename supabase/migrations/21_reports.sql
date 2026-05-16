-- DSA Article 16 — Notice and action mechanism
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_reason') THEN
    CREATE TYPE report_reason AS ENUM ('illegal_vehicle','fake_listing','prohibited_item','misleading_info','fraudulent_operator','gdpr_violation','other');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
    CREATE TYPE report_status AS ENUM ('pending','reviewing','resolved','dismissed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.rentivo_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  listing_id UUID REFERENCES public.rentivo_listings(id) ON DELETE CASCADE,
  operator_id UUID REFERENCES public.rentivo_operators(id) ON DELETE CASCADE,
  reason report_reason NOT NULL,
  description TEXT,
  status report_status DEFAULT 'pending',
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  reporter_notified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reports_listing_id ON public.rentivo_reports(listing_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.rentivo_reports(status);
ALTER TABLE public.rentivo_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rentivo_reports' AND policyname='Anyone can create reports') THEN
    CREATE POLICY "Anyone can create reports" ON public.rentivo_reports FOR INSERT WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rentivo_reports' AND policyname='Reporters see own reports') THEN
    CREATE POLICY "Reporters see own reports" ON public.rentivo_reports FOR SELECT USING (auth.uid() = reporter_id);
  END IF;
END $$;
COMMENT ON TABLE public.rentivo_reports IS 'DSA Article 16 — Notice and action mechanism.';
