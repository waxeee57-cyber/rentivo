# RLS Audit Skill
## Supabase Row Level Security ellenőrzés

### FUTTATÁS
Minden Supabase migráció után automatikusan.

### ELLENŐRZÉSI LISTA

1. Minden táblán RLS enabled?
```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```

2. Minden policy hivatkozott oszlopa indexelt?
```sql
SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public';
```

3. UPDATE policy mellé van SELECT policy?

4. Service role key nincs client-side kódban?
```bash
grep -r "service_role" --include="*.tsx" --include="*.ts" app/ components/
```

5. anon key scope megfelelő?

### TÁBLA CHECKLIST (meglévők)
- [ ] bookings — RLS enabled
- [ ] listings — RLS enabled
- [ ] users/profiles — RLS enabled
- [ ] rate_limits — service role only (16_rate_limits.sql)
- [ ] import_sessions — user_id alapú (17_import_sessions.sql)
- [ ] stripe_events — service role only (18_mrr_tracking.sql)
