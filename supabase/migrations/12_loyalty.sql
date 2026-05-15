-- Loyalty points system
CREATE TABLE IF NOT EXISTS public.rentivo_loyalty (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  points INTEGER DEFAULT 0,
  tier TEXT DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold')),
  total_earned INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_user_id ON public.rentivo_loyalty(user_id);

ALTER TABLE public.rentivo_loyalty ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own loyalty" ON public.rentivo_loyalty
  FOR SELECT USING (auth.uid() = user_id);

-- Auto-add points when booking completes
CREATE OR REPLACE FUNCTION public.add_loyalty_points()
RETURNS TRIGGER AS $$
DECLARE points_earned INTEGER;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    points_earned := FLOOR(NEW.total_amount)::INTEGER;
    INSERT INTO public.rentivo_loyalty (user_id, points, total_earned)
    VALUES (NEW.user_id, points_earned, points_earned)
    ON CONFLICT (user_id) DO UPDATE
    SET
      points = rentivo_loyalty.points + points_earned,
      total_earned = rentivo_loyalty.total_earned + points_earned,
      updated_at = NOW();
    UPDATE public.rentivo_loyalty
    SET tier = CASE
      WHEN total_earned >= 5000 THEN 'gold'
      WHEN total_earned >= 1000 THEN 'silver'
      ELSE 'bronze'
    END
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER add_loyalty_on_booking_complete
  AFTER UPDATE ON public.rentivo_bookings
  FOR EACH ROW EXECUTE FUNCTION public.add_loyalty_points();

COMMENT ON TABLE public.rentivo_loyalty IS
  '1 pont = 1 EUR elköltve. Tier: bronze/silver/gold. Trigger: booking completed.';
