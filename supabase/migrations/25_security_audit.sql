-- GDPR Article 5(2) — Elszámoltathatóság
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.security_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON public.security_audit_log(event_type, created_at DESC);
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='security_audit_log' AND policyname='Service role only') THEN
    CREATE POLICY "Service role only" ON public.security_audit_log FOR ALL USING (false);
  END IF;
END $$;
COMMENT ON TABLE public.security_audit_log IS 'GDPR Article 5(2) — Elszámoltathatóság. Megőrzési idő: 1 év.';
