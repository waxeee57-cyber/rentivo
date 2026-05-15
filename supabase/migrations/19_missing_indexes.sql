-- Hiányzó FK indexek pótlása
-- Minden REFERENCES oszlopon kell index a JOIN teljesítményhez

-- 04_chat.sql FK indexek
CREATE INDEX IF NOT EXISTS idx_conversations_booking_id
  ON rentivo_conversations(booking_id);

CREATE INDEX IF NOT EXISTS idx_conversations_listing_id
  ON rentivo_conversations(listing_id);

CREATE INDEX IF NOT EXISTS idx_conversations_operator_id
  ON rentivo_conversations(operator_id);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id
  ON rentivo_conversations(user_id);

-- 08_c2c.sql FK indexek
CREATE INDEX IF NOT EXISTS idx_hosts_auth_id
  ON rentivo_hosts(auth_id);

-- rentivo_listings.host_id (08_c2c.sql ADD COLUMN)
CREATE INDEX IF NOT EXISTS idx_listings_host_id
  ON rentivo_listings(host_id);

-- rentivo_bookings.host_id (08_c2c.sql ADD COLUMN)
CREATE INDEX IF NOT EXISTS idx_bookings_host_id
  ON rentivo_bookings(host_id);

-- 17_import_sessions.sql — listing_id FK index (user_id/status/platform már indexelt)
CREATE INDEX IF NOT EXISTS idx_import_sessions_listing_id
  ON public.import_sessions(listing_id);

COMMENT ON INDEX idx_conversations_booking_id IS 'FK index: chat conversation → booking lookup';
COMMENT ON INDEX idx_conversations_listing_id IS 'FK index: chat conversation → listing lookup';
COMMENT ON INDEX idx_conversations_operator_id IS 'FK index: chat conversation → operator lookup';
COMMENT ON INDEX idx_hosts_auth_id IS 'FK index: host → auth.users lookup (login)';
COMMENT ON INDEX idx_listings_host_id IS 'FK index: listing → host (C2C rentals filter)';
COMMENT ON INDEX idx_bookings_host_id IS 'FK index: booking → host (C2C payout routing)';
COMMENT ON INDEX idx_import_sessions_listing_id IS 'FK index: import session → created listing';
