-- One host record per account. Host setup upserts on auth_id (app/auth/host-setup.tsx)
-- and every host screen looks the row up with `.eq('auth_id', ...).maybeSingle()`,
-- which throws the moment a second row exists. There was no constraint enforcing it.
--
-- Deduplicate first: keep the oldest row per account, since its id is the one any
-- existing listing or booking points at.
delete from public.rentivo_hosts h
using public.rentivo_hosts keep
where h.auth_id = keep.auth_id
  and h.auth_id is not null
  and keep.created_at <= h.created_at
  and keep.id <> h.id;

create unique index if not exists rentivo_hosts_auth_id_key
  on public.rentivo_hosts (auth_id);
