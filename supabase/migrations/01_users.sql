-- Shared updated_at trigger function (used by all tables)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- Users: id = auth.users.id (PK is the auth UUID)
-- auth_id duplicates id for compatibility with notifications.ts (.eq('auth_id', userId))
CREATE TABLE IF NOT EXISTS public.rentivo_users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  nationality TEXT,
  driver_license_no TEXT,
  driver_license_exp TEXT,
  push_token TEXT,
  preferred_currency TEXT DEFAULT 'EUR',
  preferred_language TEXT DEFAULT 'en',
  role TEXT DEFAULT 'consumer' CHECK (role IN ('consumer', 'host', 'operator')),
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rentivo_users_auth_id ON public.rentivo_users(auth_id);
CREATE INDEX IF NOT EXISTS idx_rentivo_users_role ON public.rentivo_users(role);

ALTER TABLE public.rentivo_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own profile" ON public.rentivo_users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users update own profile" ON public.rentivo_users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users insert own profile" ON public.rentivo_users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create rentivo_users row on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.rentivo_users (id, auth_id, email, name)
  VALUES (
    NEW.id,
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMENT ON TABLE public.rentivo_users IS
  'User profiles. id = auth.users.id. auth_id duplicates id for notification queries.
   Jövőbeni kapuk: push_token (Expo push), KYC verification fields (07_verification.sql)';
