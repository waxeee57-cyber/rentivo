-- 1. rentivo_conversations had RLS on, a SELECT policy and an UPDATE policy —
--    and NO INSERT policy. Nothing server-side creates conversations either, so
--    the table has zero rows against every booking ever made. A guest typing a
--    message saw it appear (optimistic bubble), the insert was denied, the error
--    was discarded, and the message was gone on next mount. Consumer-to-owner
--    messaging has never worked, on either side.
create policy conv_participant_insert
  on public.rentivo_conversations for insert
  with check (
    exists (
      select 1 from public.rentivo_bookings b
      where b.id = rentivo_conversations.booking_id
        and (
          b.user_id = (select auth.uid())
          or exists (select 1 from public.rentivo_operators o
                     where o.id = b.operator_id and o.auth_id = (select auth.uid()))
          or exists (select 1 from public.rentivo_hosts h
                     where h.id = b.host_id and h.auth_id = (select auth.uid()))
        )
    )
  );

-- One conversation per booking, so two participants opening the thread at the
-- same moment cannot create two threads that each hold half the messages.
create unique index if not exists rentivo_conversations_booking_id_key
  on public.rentivo_conversations (booking_id);

-- 2. The promo SELECT policy filtered on `current_uses < max_uses`. With
--    max_uses NULL (unlimited) that predicate is NULL, so the row was invisible
--    and an unlimited code read as "Invalid promo code" to every client. It also
--    never checked is_active or valid_from, so a switched-off or scheduled code
--    was fully readable and passed client-side validation while the server
--    dropped it — the renter was then charged more than the button said.
drop policy if exists "Public can read active promo codes" on public.rentivo_promo_codes;
create policy "Public can read active promo codes"
  on public.rentivo_promo_codes for select
  using (
    is_active
    and (max_uses is null or current_uses < max_uses)
    and (valid_from is null or valid_from <= now())
    and (valid_until is null or valid_until > now())
  );

-- 3. rentivo_messages' read and insert policies check the traveler,
--    operator_user_id and rentivo_operators, but have no rentivo_hosts branch —
--    unlike the conversation policies, which do. A host could see that a
--    conversation existed on their own listing and neither read nor answer a
--    single message in it. Host-side chat has never worked.
drop policy if exists msg_participant_read on public.rentivo_messages;
create policy msg_participant_read
  on public.rentivo_messages for select
  using (
    exists (
      select 1 from public.rentivo_conversations c
      where c.id = rentivo_messages.conversation_id
        and (
          c.user_id = (select auth.uid())
          or c.operator_user_id = (select auth.uid())
          or exists (select 1 from public.rentivo_operators o
                     where o.id = c.operator_id and o.auth_id = (select auth.uid()))
          or exists (select 1 from public.rentivo_hosts h
                     where h.id = c.host_id and h.auth_id = (select auth.uid()))
        )
    )
  );

drop policy if exists msg_participant_insert on public.rentivo_messages;
create policy msg_participant_insert
  on public.rentivo_messages for insert
  with check (
    exists (
      select 1 from public.rentivo_conversations c
      where c.id = rentivo_messages.conversation_id
        and (
          c.user_id = (select auth.uid())
          or c.operator_user_id = (select auth.uid())
          or exists (select 1 from public.rentivo_operators o
                     where o.id = c.operator_id and o.auth_id = (select auth.uid()))
          or exists (select 1 from public.rentivo_hosts h
                     where h.id = c.host_id and h.auth_id = (select auth.uid()))
        )
    )
  );
