-- Rate limiting tábla API abuse ellen
-- Jövőbeni integráció: Edge Function middleware-rel

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL, -- IP vagy user_id
  action TEXT NOT NULL,     -- 'booking_create', 'listing_create', stb.
  count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index a gyors lookup-hoz
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier_action
  ON public.rate_limits(identifier, action, window_start);

-- RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Csak service role írhat/olvashat (Edge Functions használják)
CREATE POLICY "Service role only" ON public.rate_limits
  FOR ALL USING (false); -- public hozzáférés tiltva

-- Auto cleanup: 1 napnál régebbi rate limit rekordok törlése
-- Jövőbeni kapu: pg_cron aktiválásakor
-- SELECT cron.schedule('cleanup-rate-limits', '0 0 * * *',
--   'DELETE FROM public.rate_limits WHERE window_start < NOW() - INTERVAL ''1 day''');

COMMENT ON TABLE public.rate_limits IS
  'API rate limiting. Edge Function middleware-rel használva. Jövőbeni: pg_cron cleanup.';
