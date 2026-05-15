-- Loyalty pontok automatikus jóváírása booking completion után
-- MEGJEGYZÉS: rentivo_loyalty tábla már létezik (12_loyalty.sql)
-- A meglévő tábla user_id UNIQUE alapú — booking_id oszlopot hozzáadjuk deduplication-höz

ALTER TABLE public.rentivo_loyalty
  ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES public.rentivo_bookings(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_booking_id
  ON public.rentivo_loyalty(booking_id)
  WHERE booking_id IS NOT NULL;

CREATE OR REPLACE FUNCTION handle_booking_completed()
RETURNS TRIGGER AS $$
DECLARE
  points_earned INTEGER;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    points_earned := FLOOR(COALESCE(NEW.total_amount, 0))::INTEGER;

    INSERT INTO public.rentivo_loyalty (
      user_id,
      booking_id,
      points,
      total_earned,
      reason,
      created_at
    ) VALUES (
      NEW.user_id,
      NEW.id,
      points_earned,
      points_earned,
      'booking_completed',
      NOW()
    )
    ON CONFLICT (booking_id) DO NOTHING;

    -- Ha már létezik a user rekordja (booking_id nélkül), frissítsük a pontjait
    INSERT INTO public.rentivo_loyalty (user_id, points, total_earned)
    VALUES (NEW.user_id, points_earned, points_earned)
    ON CONFLICT (user_id) DO UPDATE
    SET
      points = rentivo_loyalty.points + EXCLUDED.points,
      total_earned = rentivo_loyalty.total_earned + EXCLUDED.total_earned,
      updated_at = NOW()
    WHERE rentivo_loyalty.booking_id IS DISTINCT FROM NEW.id;

    -- Tier frissítés
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

DROP TRIGGER IF EXISTS on_booking_completed ON public.rentivo_bookings;
CREATE TRIGGER on_booking_completed
  AFTER UPDATE ON public.rentivo_bookings
  FOR EACH ROW
  EXECUTE FUNCTION handle_booking_completed();

-- A régi trigger törlése (12_loyalty.sql-ből) — az új váltja fel
DROP TRIGGER IF EXISTS add_loyalty_on_booking_complete ON public.rentivo_bookings;
