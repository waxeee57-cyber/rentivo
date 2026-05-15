CREATE TABLE IF NOT EXISTS public.rentivo_operator_staff (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operator_id UUID NOT NULL REFERENCES rentivo_operators(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  email TEXT NOT NULL,
  role TEXT DEFAULT 'staff',
  status TEXT DEFAULT 'invited',
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ
);

ALTER TABLE public.rentivo_operator_staff ENABLE ROW LEVEL SECURITY;

-- SELECT policy (kötelező UPDATE mellé — RLS szabály)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Operators select own staff" ON public.rentivo_operator_staff;
  CREATE POLICY "Operators select own staff" ON public.rentivo_operator_staff
    FOR SELECT USING (
      operator_id IN (SELECT id FROM rentivo_operators WHERE auth_id = auth.uid())
    );
END $$;

-- ALL policy (INSERT / UPDATE / DELETE)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Operators manage own staff" ON public.rentivo_operator_staff;
  CREATE POLICY "Operators manage own staff" ON public.rentivo_operator_staff
    FOR ALL USING (
      operator_id IN (SELECT id FROM rentivo_operators WHERE auth_id = auth.uid())
    );
END $$;
