-- Scope rentivo-listings and rentivo-damage Storage uploads to the actual
-- owner/booking-party (2026-08-08 launch audit finding #4).
--
-- 26_storage_buckets.sql made both buckets private, but the INSERT (and, by
-- omission, UPDATE-on-upsert) policies only checked `auth.uid() IS NOT NULL`
-- -- ANY signed-in user could upload into ANY other listing's or ANY other
-- booking's photo folder. Paths are predictable, not secret:
--   rentivo-listings: listings/<operator_or_host_id>/<ts>-<index>.jpg
--     (lib/storage.ts:uploadListingPhoto)
--   rentivo-damage:   damage/<booking_id>/<pickup|return>/<slot>.jpg
--     (lib/storage.ts:uploadDamagePhoto)
-- so a listing id or booking id (both foreign-key-shaped but not otherwise
-- protected) was the only thing standing between a stranger and overwriting
-- someone else's listing photos or planting/overwriting damage evidence for
-- someone else's rental.
--
-- Both upload helpers use `{ upsert: true }`, so both INSERT and UPDATE need
-- the same predicate (Storage checks INSERT for new objects, UPDATE for
-- overwriting an existing one at the same path).

-- ---- rentivo-listings: only the operator/host who owns that folder -------

drop policy if exists "Operators upload listing photos" on storage.objects;

create policy "Owners upload own listing photos"
  on storage.objects for insert
  with check (
    bucket_id = 'rentivo-listings'
    and (storage.foldername(name))[1] = 'listings'
    and (
      exists (
        select 1 from public.rentivo_operators o
        where o.id::text = (storage.foldername(name))[2] and o.auth_id = auth.uid()
      )
      or exists (
        select 1 from public.rentivo_hosts h
        where h.id::text = (storage.foldername(name))[2] and h.auth_id = auth.uid()
      )
    )
  );

create policy "Owners overwrite own listing photos"
  on storage.objects for update
  using (
    bucket_id = 'rentivo-listings'
    and (storage.foldername(name))[1] = 'listings'
    and (
      exists (
        select 1 from public.rentivo_operators o
        where o.id::text = (storage.foldername(name))[2] and o.auth_id = auth.uid()
      )
      or exists (
        select 1 from public.rentivo_hosts h
        where h.id::text = (storage.foldername(name))[2] and h.auth_id = auth.uid()
      )
    )
  );

-- "Anyone reads listing photos" (public bucket-wide SELECT) is intentionally
-- left as-is: these are storefront photos served via getPublicUrl(), meant
-- to be publicly viewable. Only the write side was the vulnerability.

-- ---- rentivo-damage: only the parties to that specific booking ------------

drop policy if exists "Booking parties upload damage photos" on storage.objects;
drop policy if exists "Booking parties read damage photos" on storage.objects;

create policy "Booking parties upload damage photos"
  on storage.objects for insert
  with check (
    bucket_id = 'rentivo-damage'
    and (storage.foldername(name))[1] = 'damage'
    and exists (
      select 1 from public.rentivo_bookings b
      left join public.rentivo_operators o on o.id = b.operator_id
      left join public.rentivo_hosts h on h.id = b.host_id
      where b.id::text = (storage.foldername(name))[2]
        and (b.user_id = auth.uid() or o.auth_id = auth.uid() or h.auth_id = auth.uid())
    )
  );

create policy "Booking parties overwrite damage photos"
  on storage.objects for update
  using (
    bucket_id = 'rentivo-damage'
    and (storage.foldername(name))[1] = 'damage'
    and exists (
      select 1 from public.rentivo_bookings b
      left join public.rentivo_operators o on o.id = b.operator_id
      left join public.rentivo_hosts h on h.id = b.host_id
      where b.id::text = (storage.foldername(name))[2]
        and (b.user_id = auth.uid() or o.auth_id = auth.uid() or h.auth_id = auth.uid())
    )
  );

create policy "Booking parties read damage photos"
  on storage.objects for select
  using (
    bucket_id = 'rentivo-damage'
    and (storage.foldername(name))[1] = 'damage'
    and exists (
      select 1 from public.rentivo_bookings b
      left join public.rentivo_operators o on o.id = b.operator_id
      left join public.rentivo_hosts h on h.id = b.host_id
      where b.id::text = (storage.foldername(name))[2]
        and (b.user_id = auth.uid() or o.auth_id = auth.uid() or h.auth_id = auth.uid())
    )
  );

-- Note: the long-lived signed URLs already issued via createSignedUrl()
-- (lib/storage.ts:uploadDamagePhoto, TEN_YEARS expiry) are capability tokens
-- that bypass RLS once minted -- this migration only changes who can MINT a
-- new one (or upload/overwrite an object) going forward, matching the
-- existing rentivo-contracts bucket's owner-scoped pattern.
