-- MRR tracking infrastruktúra — Stripe webhookok alapján
-- Jövőbeni: Stripe Sigma + ChartMogul integráció €100k ARR felett

-- Stripe events tábla (webhook fogadó)
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id TEXT PRIMARY KEY, -- Stripe event ID (idempotency)
  type TEXT NOT NULL,
  data JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON public.stripe_events
  FOR ALL USING (false); -- csak Edge Function írhat/olvashat

-- MRR summary view
CREATE OR REPLACE VIEW public.mrr_summary AS
SELECT
  DATE_TRUNC('month', created_at) as month,
  COUNT(DISTINCT user_id) as active_operators,
  SUM(CASE WHEN payment_status = 'paid' THEN total_amount * 0.10 ELSE 0 END) as platform_fee_eur,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_bookings,
  SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END) as gmv_eur
FROM public.bookings
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;

COMMENT ON VIEW public.mrr_summary IS
  'MRR tracking. 10% platform fee feltételezi. Jövőbeni: Stripe Sigma + ChartMogul €100k ARR felett.';

COMMENT ON TABLE public.stripe_events IS
  'Stripe webhook events. Idempotency: Stripe event ID primary key.
   Jövőbeni: checkout.session.completed → booking update pipeline.';
