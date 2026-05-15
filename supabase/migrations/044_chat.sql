CREATE TABLE IF NOT EXISTS rentivo_conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      uuid NOT NULL REFERENCES rentivo_bookings(id),
  listing_id      uuid NOT NULL REFERENCES rentivo_listings(id),
  operator_id     uuid NOT NULL REFERENCES rentivo_operators(id),
  user_id         uuid REFERENCES rentivo_users(id),
  guest_name      text,
  guest_phone     text,
  last_message    text,
  last_message_at timestamptz,
  unread_consumer integer NOT NULL DEFAULT 0,
  unread_operator integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rentivo_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL
    REFERENCES rentivo_conversations(id) ON DELETE CASCADE,
  sender_role     text NOT NULL CHECK (sender_role IN ('consumer','operator','system')),
  sender_id       uuid,
  content         text NOT NULL,
  read            boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conv
  ON rentivo_messages(conversation_id, created_at);

ALTER TABLE rentivo_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentivo_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conv_public_read" ON rentivo_conversations
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "msg_public_read" ON rentivo_messages
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "msg_public_insert" ON rentivo_messages
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "conv_public_update" ON rentivo_conversations
  FOR UPDATE TO anon, authenticated USING (true);
