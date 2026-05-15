-- Reviews table — must exist before 06_reviews.sql adds the eligibility trigger
-- Column names match types/index.ts Review interface exactly
CREATE TABLE IF NOT EXISTS public.rentivo_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES public.rentivo_bookings(id) ON DELETE CASCADE UNIQUE NOT NULL,
  listing_id UUID REFERENCES public.rentivo_listings(id) ON DELETE CASCADE NOT NULL,
  operator_id UUID REFERENCES public.rentivo_operators(id),
  user_id UUID REFERENCES auth.users(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  reply TEXT,
  reply_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rentivo_reviews_listing_id ON public.rentivo_reviews(listing_id);
CREATE INDEX IF NOT EXISTS idx_rentivo_reviews_user_id ON public.rentivo_reviews(user_id);

ALTER TABLE public.rentivo_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reviews" ON public.rentivo_reviews
  FOR SELECT USING (true);

CREATE POLICY "Travelers create reviews for own bookings" ON public.rentivo_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Reviewers update own reviews" ON public.rentivo_reviews
  FOR UPDATE USING (auth.uid() = user_id);

-- Auto-update listing rating after review insert
CREATE OR REPLACE FUNCTION public.update_listing_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.rentivo_listings
  SET
    rating = (SELECT AVG(rating)::DECIMAL(3,2) FROM public.rentivo_reviews WHERE listing_id = NEW.listing_id),
    review_count = (SELECT COUNT(*) FROM public.rentivo_reviews WHERE listing_id = NEW.listing_id)
  WHERE id = NEW.listing_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_listing_rating_on_review
  AFTER INSERT OR UPDATE ON public.rentivo_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_listing_rating();

COMMENT ON TABLE public.rentivo_reviews IS
  'Reviews. Trigger auto-updates listing rating. Eligibility check added by 06_reviews.sql.';
