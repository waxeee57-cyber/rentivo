-- BUG (measured 2026-08-06): msg_participant_insert WITH CHECK only verifies the
-- caller is a participant of the conversation; the sender_id=auth.uid() binding
-- that 20260529002 had added was dropped in 20260805011. There is no trigger
-- backstop (rentivo_messages has zero non-internal triggers), so any participant
-- can insert a message with a forged sender_id/sender_role and have it render as
-- the other party ("full refund approved, keep the deposit"). Both clients already
-- send sender_id = auth.uid() (consumer + operator chat screens), so re-binding it
-- breaks no legitimate path and closes the impersonation-by-id vector.
--
-- Residual (tracked): sender_role is still client-supplied; a participant could set
-- sender_role to a role they don't hold while sender_id stays their own uid. The UI
-- should attribute by sender_id, not sender_role. Follow-up hardening.
alter policy "msg_participant_insert" on public.rentivo_messages
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.rentivo_conversations c
    where c.id = rentivo_messages.conversation_id
      and (
        c.user_id = (select auth.uid())
        or c.operator_user_id = (select auth.uid())
        or exists (select 1 from public.rentivo_operators o where o.id = c.operator_id and o.auth_id = (select auth.uid()))
        or exists (select 1 from public.rentivo_hosts h where h.id = c.host_id and h.auth_id = (select auth.uid()))
      )
  )
);
