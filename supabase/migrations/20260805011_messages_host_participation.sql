-- rentivo_messages' read and insert policies check the traveler, operator_user_id
-- and rentivo_operators, but have no rentivo_hosts branch — unlike the
-- conversation policies, which do. A host could therefore see that a
-- conversation existed on their own listing and neither read nor answer a single
-- message in it. Host-side chat has never worked.
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
