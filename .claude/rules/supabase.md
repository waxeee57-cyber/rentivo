---
paths: ["supabase/**", "**/*.sql"]
---

# Supabase Rules — Rentivo

## Kötelező minden migrációnál:
- ALTER TABLE előtt mindig ellenőrizd hogy a tábla létezik-e
- Minden új tábla után: ALTER TABLE x ENABLE ROW LEVEL SECURITY
- Enum CREATE TYPE: mindig DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$
- generated column SOHA enum típussal — csak TEXT-tel
- user_id NEM traveler_id — valódi mező neve user_id
- push_token nullázás: .eq('auth_id', userId) — NEM .eq('id', userId)
- reviewer_id nem létezik reviews-ban — valódi mező: user_id
- Deleted user placeholder: '00000000-0000-0000-0000-000000000001'
- security_audit_log.user_id: NEM foreign key — törölt user után is megmarad

## Valódi DB mezőnevek (rentivo_bookings):
user_id, guest_name, guest_email, guest_phone,
total_amount, platform_fee, price_per_day, subtotal

## RLS Policy pattern:
CREATE POLICY "..." ON public.table_name
  FOR SELECT/INSERT/UPDATE/DELETE
  USING (auth.uid() = user_id);

## Supabase db push előtt mindig:
npx supabase migration list
