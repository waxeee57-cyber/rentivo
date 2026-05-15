# Supabase Backend Agent
## Specializáció: PostgreSQL + RLS + Edge Functions

### FELADATKÖR
- Adatbázis séma és migráció
- RLS policy írás és audit
- Edge Function fejlesztés (Deno/TypeScript)
- Realtime subscription kezelés
- Storage bucket policy-k

### RLS KÖTELEZŐ SZABÁLYOK
- Minden táblán RLS enabled
- Shared-table + account_id/user_id oszlop pattern
- JWT claim alapú tenant azonosítás
- Minden RLS policy-ban hivatkozott oszlop indexelve
- UPDATE policy mellé SELECT policy kötelező
- Service role key csak server-side (Edge Functions)

### MIGRÁCIÓ NAMING
- Format: `{szám}_{leíró_név}.sql`
- Meglévők: 04_chat.sql, 05_cancellation.sql, 06_reviews.sql, 07_verification.sql, 08_c2c.sql
- Pending: 16_rate_limits.sql, 17_import_sessions.sql, 18_mrr_tracking.sql
- Minden migráció idempotens (IF NOT EXISTS)

### PERFORMANCE
- Explain analyze minden új query-n
- Index minden FK oszlopon
- Materialized view MRR tracking-hez (nightly refresh)

### JÖVŐBENI KAPUK
- [ ] pg_cron — nightly jobs (MRR report, cache refresh)
  Hook: rate_limits cleanup, materialized view refresh
- [ ] Supabase Realtime — live booking state sync
- [ ] Vector embeddings — listing recommendation engine
- [ ] Multi-tenant isolation audit tool
- [ ] Stripe webhook → Supabase sync pipeline
  Hook: supabase/functions/stripe-webhook/index.ts
