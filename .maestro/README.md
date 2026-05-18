# Rentivo — Maestro E2E Teszt Suite

## Mi a Maestro és miért?

A [Maestro](https://maestro.mobile.dev/) egy mobil UI tesztelési keretrendszer, amely YAML alapú flow-kkal írja le a felhasználói interakciókat. Nem igényel kódolást — a tesztek ember által olvashatóak és karbantarthatóak.

**Miért Maestro a Rentivo-hoz:**
- Nulla boilerplate: YAML flow = azonnal futtatható teszt
- Android és iOS egységes szintaxis
- CI/CD integrálható (GitHub Actions, Bitrise, EAS)
- Képernyőfotók minden flow végén → vizuális regresszió detektálás
- Tag-alapú futtatás: `smoke`, `critical`, `regression`

---

## Telepítés (Windows — PowerShell)

```powershell
# 1. Maestro CLI telepítés
iwr -useb https://get.maestro.mobile.dev | pwsh

# 2. Verzió ellenőrzés
maestro --version

# 3. Java szükséges Android-hoz (ha nincs)
winget install EclipseAdoptium.Temurin.17.JDK
```

**Android emulátor indítása:**
```powershell
# Android Studio → Device Manager → Start
# Vagy AVD Manager CLI-vel:
emulator -avd Pixel_7_API_34
```

---

## Futtatás

### Összes flow futtatása
```powershell
npm run test:e2e
```

### Csak smoke tesztek (gyors, ~3 perc)
```powershell
npm run test:e2e:smoke
```

### Csak kritikus tesztek
```powershell
npm run test:e2e:critical
```

### Egy konkrét flow futtatása
```powershell
npm run test:e2e:single .maestro/flows/01-onboarding-consumer.yaml
```

### Interaktív felvétel (új flow rögzítése)
```powershell
npm run test:e2e:record
```

---

## Struktúra

```
.maestro/
  config.yaml                    ← globális konfiguráció (appId, env vars)
  flows/
    01-onboarding-consumer.yaml  ← Consumer onboarding teljes út
    02-onboarding-host.yaml      ← Host onboarding teljes út
    03-onboarding-operator.yaml  ← Operator onboarding teljes út
    04-explore-search.yaml       ← Keresés és szűrés
    05-listing-detail.yaml       ← Listing részletek, gallery
    06-booking-date-picker.yaml  ← Dátumválasztó sheet
    07-booking-no-date-guard.yaml← Guard: dátum nélküli foglalás
    08-promo-code.yaml           ← Promo kód alkalmazás
    09-consumer-profile.yaml     ← Profil képernyő
    10-consumer-reviews.yaml     ← Értékelések lista
    11-bookings-list.yaml        ← Foglalások lista
    12-ai-assistant-back-nav.yaml← AI asszisztens + vissza navigáció
    13-theme-light-dark-toggle.yaml ← Téma váltás
    14-profile-language-switch.yaml ← Nyelv váltás EN↔HU
    15-host-dashboard.yaml       ← Host listings főképernyő
    16-host-new-listing.yaml     ← Új listing wizard indítás
    17-operator-dashboard.yaml   ← Operator dashboard statisztikák
    18-operator-fleet-edit.yaml  ← Fleet kártya megnyitás
    19-operator-calendar.yaml    ← Naptár nézet
    20-tab-bar-icons-render.yaml ← Tab bar ikonok (nincs ▼ karakter)
  helpers/
    login-demo.yaml              ← Consumer gyors belépés (Skip)
    clear-state.yaml             ← App state törlés helper
```

---

## Flow leírások

| # | Flow | Tag | Mit tesztel |
|---|------|-----|-------------|
| 01 | Consumer onboarding | smoke, critical | Teljes onboarding → Explore |
| 02 | Host onboarding | smoke | Role card → My Listings |
| 03 | Operator onboarding | smoke | Role card → Dashboard |
| 04 | Keresés és szűrés | smoke | SearchBar, filter, találatok |
| 05 | Listing részlet | smoke, critical | Kép gallery, foglalás gomb |
| 06 | Dátumválasztó | smoke, critical | DatePickerSheet, dátum választás |
| 07 | Dátum guard | regression | Foglalás dátum nélkül → sheet nyílik |
| 08 | Promo kód | regression | Promo apply, EUR formázás |
| 09 | Consumer profil | smoke | Profil adatok, beállítások |
| 10 | Értékelések | regression | Reviews lista, csillagok |
| 11 | Foglalások lista | smoke, regression | My Trips, Upcoming tab |
| 12 | AI asszisztens | smoke, regression | Chat, suggestion chip, vissza nav |
| 13 | Téma toggle | smoke, critical | Dark/Light váltás |
| 14 | Nyelv váltás | regression | EN→HU→EN, tab bar lokalizálva |
| 15 | Host dashboard | smoke, regression | My Listings betölt |
| 16 | Új listing | smoke, regression | Wizard 1. lépés, kategória |
| 17 | Operator dashboard | smoke, critical | Revenue, Bookings stats |
| 18 | Fleet szerkesztés | regression | Fleet kártya → edit form |
| 19 | Naptár | smoke, regression | Hónap grid, navigáció |
| 20 | Tab bar ikonok | smoke, critical | Nincs ▼ fallback, minden tab |

---

## CI/CD integráció (GitHub Actions)

```yaml
# .github/workflows/e2e.yml
name: E2E Tests
on: [push]
jobs:
  maestro:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Maestro
        run: curl -Ls https://get.maestro.mobile.dev | bash
      - name: Run smoke tests
        run: maestro test .maestro/flows/ --include-tags=smoke
```

---

## Ajánlott futtatási sorrend (első használathoz)

1. **Smoke tesztek** (`npm run test:e2e:smoke`) — ~3 perc, lefedi az összes kritikus utat
2. **Critical tesztek** — biztonsági hálóként minden deploy előtt
3. **Teljes suite** — éjszakai CI futtatás, PR merge előtt

**Legelőször futtasd:**
- `20-tab-bar-icons-render` — azonnal kiderül, hogy az icon font betölt-e
- `01-onboarding-consumer` — alap onboarding path
- `17-operator-dashboard` — legkomplexebb belépési út

---

## Hibaelhárítás

**"App not found"**: Győződj meg róla, hogy az emulátor fut és az app telepítve van (`npx expo run:android`).

**"Element not found"**: A szöveg megváltozott? Frissítsd a flow-t az aktuális szöveggel.

**"Timeout"**: Növeld a `timeout` értéket a `scrollUntilVisible` lépéseknél.

**Lassú animáció**: Az emulátorban kapcsold ki az animációkat: Developer Options → Animator duration scale → Off.
