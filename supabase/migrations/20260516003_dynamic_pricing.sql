ALTER TABLE public.rentivo_listings
ADD COLUMN IF NOT EXISTS pricing_rules JSONB DEFAULT '{}'::JSONB;
