-- Wishlist / saved listings per user
CREATE TABLE IF NOT EXISTS public.rentivo_wishlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  listing_id UUID REFERENCES public.rentivo_listings(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_user_id ON public.rentivo_wishlist(user_id);

ALTER TABLE public.rentivo_wishlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own wishlist" ON public.rentivo_wishlist
  FOR ALL USING (auth.uid() = user_id);
