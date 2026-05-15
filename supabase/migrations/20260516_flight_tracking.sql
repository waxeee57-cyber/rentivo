ALTER TABLE public.rentivo_bookings
ADD COLUMN IF NOT EXISTS flight_number TEXT,
ADD COLUMN IF NOT EXISTS flight_arrival_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS flight_status TEXT DEFAULT 'unknown';
