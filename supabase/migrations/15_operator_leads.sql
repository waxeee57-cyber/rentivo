-- Operator lead tracking (marketing automation)
CREATE TABLE IF NOT EXISTS public.operator_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  email TEXT NOT NULL UNIQUE,
  company TEXT,
  city TEXT,
  country TEXT,
  category TEXT,
  status TEXT DEFAULT 'contacted'
    CHECK (status IN ('contacted', 'replied', 'demo_scheduled', 'converted', 'lost')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
  -- Jövőbeni kapuk:
  -- smartlead_campaign_id TEXT,  -- Smartlead cold email kampány
  -- smartlead_contact_id TEXT,   -- Smartlead kontakt ID
);

ALTER TABLE public.operator_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.operator_leads
  FOR ALL USING (false);

CREATE TRIGGER update_operator_leads_updated_at
  BEFORE UPDATE ON public.operator_leads
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

COMMENT ON TABLE public.operator_leads IS
  'Operator lead tracking. Jövőbeni kapu: Smartlead cold email integráció, Dominik/sales flow';
