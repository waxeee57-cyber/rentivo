-- Operator Tier Badge system: New → Verified → Top → Elite
ALTER TABLE public.rentivo_operators
ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'new',
ADD COLUMN IF NOT EXISTS total_bookings INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS response_rate NUMERIC(5,2) DEFAULT 100,
ADD COLUMN IF NOT EXISTS avg_rating NUMERIC(3,2) DEFAULT 0;
