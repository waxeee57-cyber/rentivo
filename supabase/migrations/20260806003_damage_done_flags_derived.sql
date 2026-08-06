-- pickup_damage_done / return_damage_done are a CACHE of "a damage report of
-- this type exists for this booking". They were written by the client, and
-- revoking that grant (correctly, since a renter must not be able to flip the
-- flags that gate the inspection screens) left nothing writing them at all.
--
-- Granting the write back would restore the original problem: a flag the client
-- controls can disagree with the evidence it claims to describe, in both
-- directions. Deriving it from the report itself makes disagreement impossible,
-- and it stays correct no matter which surface files the inspection.
create or replace function public.rentivo_sync_damage_done()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if tg_op = 'DELETE' then
    update public.rentivo_bookings
       set pickup_damage_done = exists (
             select 1 from public.rentivo_damage_reports r
             where r.booking_id = old.booking_id and r.type = 'pickup'),
           return_damage_done = exists (
             select 1 from public.rentivo_damage_reports r
             where r.booking_id = old.booking_id and r.type = 'return')
     where id = old.booking_id;
    return old;
  end if;

  update public.rentivo_bookings
     set pickup_damage_done = exists (
           select 1 from public.rentivo_damage_reports r
           where r.booking_id = new.booking_id and r.type = 'pickup'),
         return_damage_done = exists (
           select 1 from public.rentivo_damage_reports r
           where r.booking_id = new.booking_id and r.type = 'return')
   where id = new.booking_id;
  return new;
end;
$$;

drop trigger if exists rentivo_damage_reports_sync_done on public.rentivo_damage_reports;
create trigger rentivo_damage_reports_sync_done
  after insert or update or delete on public.rentivo_damage_reports
  for each row execute function public.rentivo_sync_damage_done();

-- Backfill: every booking that already has evidence but never got its flag,
-- because the client write was failing.
update public.rentivo_bookings b
   set pickup_damage_done = exists (
         select 1 from public.rentivo_damage_reports r where r.booking_id = b.id and r.type = 'pickup'),
       return_damage_done = exists (
         select 1 from public.rentivo_damage_reports r where r.booking_id = b.id and r.type = 'return')
 where exists (select 1 from public.rentivo_damage_reports r where r.booking_id = b.id);
