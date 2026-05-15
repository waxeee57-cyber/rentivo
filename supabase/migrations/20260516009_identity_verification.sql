CREATE TABLE IF NOT EXISTS public.rentivo_identity_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  didit_session_id TEXT UNIQUE,
  status TEXT DEFAULT 'pending',
  document_type TEXT,
  document_country TEXT,
  document_number TEXT,
  full_name TEXT,
  date_of_birth DATE,
  document_expires_at DATE,
  face_match_score NUMERIC(5,2),
  liveness_passed BOOLEAN,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_identity_verifications_user_id
  ON public.rentivo_identity_verifications(user_id);

CREATE INDEX IF NOT EXISTS idx_identity_verifications_status
  ON public.rentivo_identity_verifications(status);

ALTER TABLE public.rentivo_identity_verifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies WHERE tablename = 'rentivo_identity_verifications' AND policyname = 'Users see own verification'
  ) THEN
    CREATE POLICY "Users see own verification" ON public.rentivo_identity_verifications
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies WHERE tablename = 'rentivo_identity_verifications' AND policyname = 'Users insert own verification'
  ) THEN
    CREATE POLICY "Users insert own verification" ON public.rentivo_identity_verifications
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE public.rentivo_bookings
  ADD COLUMN IF NOT EXISTS requires_identity_verification BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN DEFAULT false;

ALTER TABLE public.rentivo_users
  ADD COLUMN IF NOT EXISTS identity_status TEXT DEFAULT 'unverified';

ALTER TABLE public.rentivo_operators
  ADD COLUMN IF NOT EXISTS requires_identity_verification BOOLEAN DEFAULT false;
