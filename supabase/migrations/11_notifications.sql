-- In-app notifications
CREATE TABLE IF NOT EXISTS public.rentivo_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.rentivo_notifications(user_id, is_read, created_at DESC);

ALTER TABLE public.rentivo_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications" ON public.rentivo_notifications
  FOR ALL USING (auth.uid() = user_id);

COMMENT ON TABLE public.rentivo_notifications IS
  'In-app értesítések. Jövőbeni kapu: Expo push notification küldés Edge Function-ből';
