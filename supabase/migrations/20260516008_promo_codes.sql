CREATE TABLE IF NOT EXISTS public.rentivo_promo_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC(10,2) NOT NULL,
  max_uses INTEGER DEFAULT 100,
  current_uses INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  min_booking_value NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.rentivo_promo_codes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  DROP POLICY IF EXISTS "Public can read active promo codes" ON public.rentivo_promo_codes;
  CREATE POLICY "Public can read active promo codes" ON public.rentivo_promo_codes
    FOR SELECT USING (
      current_uses < max_uses
      AND (valid_until IS NULL OR valid_until > NOW())
    );
END $$;

CREATE TABLE IF NOT EXISTS public.rentivo_referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id),
  referred_user_id UUID REFERENCES auth.users(id),
  referral_code TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending',
  reward_points INTEGER DEFAULT 500,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.rentivo_referrals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users manage own referrals" ON public.rentivo_referrals;
  CREATE POLICY "Users manage own referrals" ON public.rentivo_referrals
    FOR ALL USING (referrer_user_id = auth.uid() OR referred_user_id = auth.uid());
END $$;

ALTER TABLE public.rentivo_bookings
ADD COLUMN IF NOT EXISTS promo_code TEXT,
ADD COLUMN IF NOT EXISTS promo_discount NUMERIC(10,2) DEFAULT 0;

-- Seed promo codes
INSERT INTO public.rentivo_promo_codes (code, discount_type, discount_value, max_uses)
VALUES
  ('WELCOME10', 'percent', 10, 1000),
  ('MARBELLA20', 'percent', 20, 500),
  ('SUMMER50', 'fixed', 50, 200)
ON CONFLICT (code) DO NOTHING;
