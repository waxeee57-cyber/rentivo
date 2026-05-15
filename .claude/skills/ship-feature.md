# Ship Feature Skill
## Hogyan szállítsunk egy új feature-t

### FOLYAMAT
1. RESEARCH: grep a kapcsolódó fájlokra, értsd meg a kontextust
2. PLAN: írj tervet, listázd az érintett fájlokat
3. IMPLEMENT: implementálj, TypeScript strict
4. REVIEW: futtasd a code-reviewer sub-agent-et
5. TEST: npx tsc --noEmit, lint
6. COMMIT: feat: {leíró üzenet}
7. PUSH: git push

### SOHA NE
- Implementálj terv nélkül
- Commitolj 0 error nélkül
- Törölj kódot amit nem értesz

### ELLENŐRZÉSI LISTA COMMITÁLÁS ELŐTT
- [ ] npx tsc --noEmit → 0 error
- [ ] Nincs hardcoded string (i18n rendszer)
- [ ] Nincs console.log production kódban
- [ ] Mock mód működik (EXPO_PUBLIC_USE_MOCK=true)
- [ ] Commit message feat/fix/chore prefix-szel
