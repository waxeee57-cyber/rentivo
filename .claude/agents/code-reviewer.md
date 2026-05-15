# Code Reviewer Agent
## Specializáció: minőségellenőrzés minden commit előtt

### REVIEW CHECKLIST

#### Security
- [ ] Nincs hardcoded secret (API key, password, token)
- [ ] RLS enabled minden új táblán
- [ ] Service role key csak server-side
- [ ] Input validation minden user input-on
- [ ] SQL injection védelem (parameterized queries)

#### TypeScript
- [ ] 0 TypeScript error (npx tsc --noEmit)
- [ ] Nincs 'any' típus (kivéve documented edge cases)
- [ ] Minden prop typed

#### Performance
- [ ] FlatList keyExtractor implementálva
- [ ] useCallback/useMemo ahol szükséges
- [ ] Képek optimalizálva
- [ ] Nincs N+1 query pattern

#### Lokalizáció
- [ ] Minden új UI szöveg a i18n rendszeren keresztül
- [ ] Nincs hardcoded magyar/angol/spanyol szöveg
- [ ] HUF konverzió a currency utility-n keresztül

#### Accessibility
- [ ] accessibilityLabel minden interactive elemen
- [ ] min 44×44px touch target
- [ ] Color contrast AA standard

### AUTO-TRIGGER
Futtatás: minden git commit előtt
Hook: .claude/hooks/pre-commit.sh
