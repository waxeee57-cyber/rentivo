-- ════════════════════════════════════════════════════════════════════════════
-- B3 — chat RLS lockdown: close world-readable private conversations/messages
-- ════════════════════════════════════════════════════════════════════════════
--
-- Problem: 044_chat.sql ships four fully-permissive policies —
--   conv_public_read / msg_public_read (SELECT ... USING (true)),
--   msg_public_insert (INSERT ... WITH CHECK (true)),
--   conv_public_update (UPDATE ... USING (true)), all TO anon, authenticated.
-- Anyone holding the anon key (it ships in the public client bundle) could read
-- EVERY private conversation/message and post into any thread → GDPR leak.
--
-- Participant binding (rentivo_conversations):
--   user_id          = the consumer  (rentivo_users.id, and rentivo_users.id =
--                                     auth.users.id — see 01_users.sql)
--   operator_user_id = the operator's auth.users.id (added by 29_conversations_fix.sql)
--   operator_id      = rentivo_operators.id whose .auth_id = auth.uid()
--                      (kept as a fallback path: consumer-created rows may have
--                       operator_user_id = NULL — see lib/api/chat.ts createConversation)
-- A row's participants are therefore:
--   auth.uid() = user_id
--   OR auth.uid() = operator_user_id
--   OR EXISTS(rentivo_operators WHERE id = operator_id AND auth_id = auth.uid())
--
-- anon: gets NOTHING — every new policy is TO authenticated only.
-- service_role: bypasses RLS (BYPASSRLS), so webhooks/system keep full access; no
--   policy needed for it.
--
-- Scope note: this migration recreates exactly the access the old policies exposed
-- (conv SELECT, conv UPDATE, msg SELECT, msg INSERT) but scoped to participants.
-- It deliberately does NOT add a conversations INSERT policy — none existed before
-- (conv INSERT was already denied under 044), so behavior is unchanged. See the
-- "client impact" note returned with this change re: lib/api/chat.ts createConversation.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Drop the permissive world-readable policies ──────────────────────────
DROP POLICY IF EXISTS "conv_public_read"   ON public.rentivo_conversations;
DROP POLICY IF EXISTS "conv_public_update" ON public.rentivo_conversations;
DROP POLICY IF EXISTS "msg_public_read"    ON public.rentivo_messages;
DROP POLICY IF EXISTS "msg_public_insert"  ON public.rentivo_messages;

-- ── 2. Indexes for the participant predicate — ALL ALREADY EXIST, no-op here ─
--   rentivo_conversations(user_id):          19_missing_indexes.sql
--   rentivo_conversations(operator_id):      19_missing_indexes.sql
--   rentivo_conversations(operator_user_id): 29_conversations_fix.sql
--   rentivo_operators(auth_id):              02_operators.sql + 19_missing_indexes.sql
--   rentivo_messages(conversation_id):       044_chat.sql (idx_messages_conv)
-- No new index required — every column the policies below filter/join on is indexed.

-- ── 3. Conversations: participant-only SELECT ───────────────────────────────
CREATE POLICY "conv_participant_read" ON public.rentivo_conversations
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() = operator_user_id
    OR EXISTS (
      SELECT 1 FROM public.rentivo_operators o
      WHERE o.id = rentivo_conversations.operator_id AND o.auth_id = auth.uid()
    )
  );

-- ── 4. Conversations: participant-only UPDATE (unread counters, last_read) ───
--   WITH CHECK keeps the caller a participant of the resulting row; the binding
--   columns themselves are frozen by the trigger in step 7.
CREATE POLICY "conv_participant_update" ON public.rentivo_conversations
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() = operator_user_id
    OR EXISTS (
      SELECT 1 FROM public.rentivo_operators o
      WHERE o.id = rentivo_conversations.operator_id AND o.auth_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR auth.uid() = operator_user_id
    OR EXISTS (
      SELECT 1 FROM public.rentivo_operators o
      WHERE o.id = rentivo_conversations.operator_id AND o.auth_id = auth.uid()
    )
  );

-- ── 5. Messages: participant-only SELECT (via parent conversation) ──────────
CREATE POLICY "msg_participant_read" ON public.rentivo_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rentivo_conversations c
      WHERE c.id = rentivo_messages.conversation_id
        AND (
          auth.uid() = c.user_id
          OR auth.uid() = c.operator_user_id
          OR EXISTS (
            SELECT 1 FROM public.rentivo_operators o
            WHERE o.id = c.operator_id AND o.auth_id = auth.uid()
          )
        )
    )
  );

-- ── 6. Messages: participant-only INSERT, and only as oneself ───────────────
--   sender_id = auth.uid() prevents posting under another user's identity.
CREATE POLICY "msg_participant_insert" ON public.rentivo_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.rentivo_conversations c
      WHERE c.id = rentivo_messages.conversation_id
        AND (
          auth.uid() = c.user_id
          OR auth.uid() = c.operator_user_id
          OR EXISTS (
            SELECT 1 FROM public.rentivo_operators o
            WHERE o.id = c.operator_id AND o.auth_id = auth.uid()
          )
        )
    )
  );

-- ── 7. Freeze conversation participant/binding columns against authenticated ─
--   RLS WITH CHECK cannot see OLD, so it cannot stop a participant from rewriting
--   the OTHER party's binding column. A BEFORE UPDATE trigger comparing OLD/NEW can.
--   service_role / superuser (auth.uid() IS NULL) bypass.
CREATE OR REPLACE FUNCTION public.rentivo_conversations_guard_binding_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.booking_id       IS DISTINCT FROM OLD.booking_id
     OR NEW.listing_id       IS DISTINCT FROM OLD.listing_id
     OR NEW.operator_id      IS DISTINCT FROM OLD.operator_id
     OR NEW.operator_user_id IS DISTINCT FROM OLD.operator_user_id
     OR NEW.user_id          IS DISTINCT FROM OLD.user_id
  THEN
    RAISE EXCEPTION
      'rentivo_conversations: participant/binding columns can only be changed by the server (service_role). User % attempted a forbidden update.', auth.uid()
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rentivo_conversations_guard_binding ON public.rentivo_conversations;
CREATE TRIGGER rentivo_conversations_guard_binding
  BEFORE UPDATE ON public.rentivo_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.rentivo_conversations_guard_binding_columns();

COMMENT ON FUNCTION public.rentivo_conversations_guard_binding_columns() IS
  'B3: blocks authenticated clients from changing conversation participant/binding
   columns (booking_id, listing_id, operator_id, operator_user_id, user_id).
   service_role / superuser bypass via NULL auth.uid().';
