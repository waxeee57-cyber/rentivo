-- Operator profiles (fleet managers, B2B)
-- Column names match types/index.ts Operator interface exactly
CREATE TABLE IF NOT EXISTS public.rentivo_operators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  logo_url TEXT,
  cover_image_url TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  country TEXT DEFAULT 'ES',
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  rating DECIMAL(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  stripe_account_id TEXT,
  stripe_onboarded BOOLEAN DEFAULT false,
  push_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rentivo_operators_auth_id ON public.rentivo_operators(auth_id);
CREATE INDEX IF NOT EXISTS idx_rentivo_operators_city ON public.rentivo_operators(city);
CREATE INDEX IF NOT EXISTS idx_rentivo_operators_active ON public.rentivo_operators(active);

ALTER TABLE public.rentivo_operators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active operators" ON public.rentivo_operators
  FOR SELECT USING (active = true);

CREATE POLICY "Operators manage own profile" ON public.rentivo_operators
  FOR ALL USING (auth.uid() = auth_id);

CREATE TRIGGER update_rentivo_operators_updated_at
  BEFORE UPDATE ON public.rentivo_operators
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

COMMENT ON TABLE public.rentivo_operators IS
  'Fleet manager profiles. stripe_account_id + stripe_onboarded for Connect.
   Jövőbeni kapuk: heygen_avatar_id (HeyGen video), channel_manager_id (Hostaway)';
