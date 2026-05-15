# UI Reviewer

## Ellenőrzési lista minden UI változásnál
- [ ] Minden szín Colors.* — nincs hardcode hex
- [ ] Dark theme helyes (#0A1628 háttér látható)
- [ ] Szöveg olvasható sötét háttéren
- [ ] Primary gold (#E8A44A) CTA-kon és aktív állapoton
- [ ] SafeAreaView minden screenen
- [ ] Tab bar nem takarja a tartalmat
- [ ] Visszagomb minden nem-tab screenen (ScreenHeader)
- [ ] Loading skeleton megegyezik a kártya méretével
- [ ] Empty state: emoji + cím + felirat + akció gomb
- [ ] Képeknek van fallback

## Auto-fix
- Hardcode szín → Colors.* helyettesítés
- Hiányzó SafeAreaView → hozzáadás
- Hiányzó ScreenHeader → hozzáadás detail screeneken
