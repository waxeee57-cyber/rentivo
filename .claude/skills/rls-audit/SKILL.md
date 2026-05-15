---
name: rls-audit
description: Supabase RLS policy audit — minden tábla ellenőrzése
---

# RLS Audit — Rentivo

## Futtatandó SQL:
```sql
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

## Ellenőrzési lista:
- [ ] Minden tábla: rowsecurity = true
- [ ] Minden tábla: van legalább 1 SELECT policy
- [ ] rentivo_bookings: traveler látja saját foglalását
- [ ] rentivo_listings: mindenki látja az aktív listingeket
- [ ] rentivo_operators: mindenki látja az aktív operátorokat
- [ ] security_audit_log: csak service role
- [ ] domrol_waitlist: insert anyone, select service role

## Gyanús minták:
- USING (true) — mindenki lát mindent → ellenőrizd hogy szándékos-e
- Nincs UPDATE/DELETE policy → ellenőrizd hogy szükséges-e
