# Test Runner Agent
## Specializáció: automatikus tesztelés

### JELENLEGI TESZTEK
- TypeScript: npx tsc --noEmit
- Lint: npx eslint . --ext .ts,.tsx

### FUTTATÁS
```bash
cd C:\projects\Rentivo
npx tsc --noEmit
```

### JÖVŐBENI TESZTEK (kapuk)
- [ ] Jest + React Native Testing Library — unit tests
  Aktiválás: első 50 komponens után
- [ ] Detox — E2E mobile testing
  Aktiválás: App Store launch előtt
- [ ] Playwright — web E2E testing (rentivo-web)
  Aktiválás: programmatic SEO oldalak előtt
- [ ] Supabase local testing — pgTAP + supabase db push
  Aktiválás: minden migration előtt

### AUTO-TRIGGER
Minden fájl módosítás után:
1. TypeScript check az érintett fájlra
2. Lint check
3. Ha Supabase fájl: RLS policy audit
