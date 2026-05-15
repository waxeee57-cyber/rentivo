-- Hourly Rental Feature
-- Adds hourly rental support to listings and bookings

ALTER TABLE public.rentivo_listings
  ADD COLUMN IF NOT EXISTS hourly_rental_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_per_hour NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS min_rental_hours INTEGER DEFAULT 2;

ALTER TABLE public.rentivo_bookings
  ADD COLUMN IF NOT EXISTS rental_type TEXT DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time TIME,
  ADD COLUMN IF NOT EXISTS total_hours INTEGER;
