-- Add operator_user_id to rentivo_conversations
-- Allows querying conversations by the operator's auth.users UUID directly
-- (complements operator_id which references rentivo_operators.id)
ALTER TABLE public.rentivo_conversations
  ADD COLUMN IF NOT EXISTS operator_user_id UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_conversations_operator_user_id
  ON public.rentivo_conversations(operator_user_id);

COMMENT ON COLUMN public.rentivo_conversations.operator_user_id IS
  'auth.users.id of the operator — for direct RLS lookups without joining rentivo_operators';
