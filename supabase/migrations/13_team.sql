-- Operator team members
CREATE TABLE IF NOT EXISTS public.rentivo_team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operator_id UUID REFERENCES public.rentivo_operators(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'staff' CHECK (role IN ('owner', 'manager', 'staff')),
  permissions JSONB DEFAULT '{"bookings": true, "chat": true, "fleet": false, "payouts": false}',
  is_active BOOLEAN DEFAULT true,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  UNIQUE(operator_id, email)
);

CREATE INDEX IF NOT EXISTS idx_team_members_operator_id ON public.rentivo_team_members(operator_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.rentivo_team_members(user_id);

ALTER TABLE public.rentivo_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators see own team" ON public.rentivo_team_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.rentivo_operators
      WHERE id = operator_id AND auth_id = auth.uid()
    )
  );

CREATE POLICY "Operators manage own team" ON public.rentivo_team_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.rentivo_operators
      WHERE id = operator_id AND auth_id = auth.uid()
    )
  );
