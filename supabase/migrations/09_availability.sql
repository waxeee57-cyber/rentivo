-- Blocked dates per listing (availability calendar)
CREATE TABLE IF NOT EXISTS public.rentivo_availability (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID REFERENCES public.rentivo_listings(id) ON DELETE CASCADE NOT NULL,
  blocked_date DATE NOT NULL,
  reason TEXT DEFAULT 'booking',
  booking_id UUID REFERENCES public.rentivo_bookings(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id, blocked_date)
);

CREATE INDEX IF NOT EXISTS idx_availability_listing_date
  ON public.rentivo_availability(listing_id, blocked_date);

ALTER TABLE public.rentivo_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view availability" ON public.rentivo_availability
  FOR SELECT USING (true);

CREATE POLICY "Owners manage availability" ON public.rentivo_availability
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.rentivo_listings l
      WHERE l.id = listing_id AND l.owner_user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.rentivo_availability IS
  'Blocked dates per listing. reason: booking/maintenance/ical_sync.
   Jövőbeni kapu: iCal import auto-blokkolás, Nylas calendar API, channel manager sync';
