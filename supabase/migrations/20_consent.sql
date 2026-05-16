-- GDPR Article 7 — Conditions for consent
CREATE TABLE IF NOT EXISTS public.rentivo_consent (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  terms_accepted BOOLEAN DEFAULT false,
  terms_accepted_at TIMESTAMPTZ,
  terms_version TEXT DEFAULT '1.0',
  privacy_accepted BOOLEAN DEFAULT false,
  privacy_accepted_at TIMESTAMPTZ,
  privacy_version TEXT DEFAULT '1.0',
  marketing_email BOOLEAN DEFAULT false,
  marketing_email_at TIMESTAMPTZ,
  marketing_push BOOLEAN DEFAULT false,
  marketing_push_at TIMESTAMPTZ,
  analytics BOOLEAN DEFAULT false,
  analytics_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  platform TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
CREATE INDEX IF NOT EXISTS idx_consent_user_id ON public.rentivo_consent(user_id);
ALTER TABLE public.rentivo_consent ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rentivo_consent' AND policyname='Users manage own consent') THEN
    CREATE POLICY "Users manage own consent" ON public.rentivo_consent
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='update_consent_updated_at') THEN
    CREATE TRIGGER update_consent_updated_at
  BEFORE UPDATE ON public.rentivo_consent
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
  END IF;
END $$;
COMMENT ON TABLE public.rentivo_consent IS 'GDPR Article 7 consent records. Minden hozzájárulás timestampelt és verziókövetett.';
