# RENTIVO — HANDOFF a következő Cowork chatre
**Dátum:** 2026-08-04 | **Repo:** `C:\projects\Rentivo` | **Branch:** `feat/payments-deposit-model-b`
**Állapot:** store-ready build + teljes design-átépítés kész, végső regresszió futott/fut

---

## 1. AZONNALI TEENDŐK (ezekkel kezdj)

| # | Feladat | Parancs / hely |
|---|---|---|
| 1 | **Maestro végső futás ellenőrzése** a release buildre | `Get-Content C:\projects\newbot\_qa\maestro-final.log \| Select-String '\[Passed\]\|\[Failed\]\|Flows'` |
| 2 | ~~`npx tsc --noEmit`~~ ✅ **0 hiba** (lefutott a session végén, `_qa\tsc.log` üres) | — |
| 3 | **Flow 10 (Booking) újrafuttatás** — a dock-átállás körében egyszer elhasalt (3m41s timeout), a 15-ös hasonló flake volt és retry-ra zöld lett | `maestro test .maestro\flows\10-booking-flow-mock.yaml` |
| 4 | **Commit** — 83 módosított/új fájl, semmi nincs commitolva | lásd §6 |

---

## 2. MI KÉSZÜLT EL EBBEN A SESSIONBEN

### Térkép (Leaflet, 0 Ft)
- **Új fájl:** `components/map/LeafletMap.tsx` — WebView + Leaflet 1.9.4 CDN, CARTO tiles (voyager light / dark_all dark), ár-pill divIcon markerek, `postMessage` pin-tap, `fitBounds`.
- Bekötve **két** helyre: `components/map/ListingsMap.tsx` (Search tab) és `app/(consumer)/explore/index.tsx` (`!Config.mapsEnabled` ág — a régi „Map view (native only)" emoji-placeholder helyére).
- **Ok-gyök a hiányzó pinekre:** mind az 5 listing `latitude`/`longitude` NULL volt a Supabase-ben → feltöltve Marbella-koordinátákkal (36.504–36.519, −4.87…−4.90). Supabase project: `xeyfsacbozucxrwlefro`, tábla `rentivo_listings`.
- Kiválasztott pin **ink** (light: navy `#0A1628`, dark: világos), nem narancs — az akcentus csak CTA-ké.

### Release build + aláírás
- Saját **release keystore**: `android/app/rentivo-release.keystore` (alias `rentivo`, CN=Rentivo/Marbella/ES, 30 év).
- Jelszó: `android/keystore.properties` (**gitignore-olva**). `app/build.gradle` release ága ebből ír alá, fallback debug keystore-ra ha a properties hiányzik.
- ⚠️ **A keystore + jelszó elvesztése = az app soha többé nem frissíthető a Play Store-ban.** Biztonsági mentés kell (jelszókezelő + offline másolat).
- Build: `assembleRelease` + `bundleRelease` zöld. Kimenet:
  - `android/app/build/outputs/apk/release/app-release.apk` (~140 MB)
  - `android/app/build/outputs/bundle/release/app-release.aab` (~92 MB) ← **ez megy a Play Console-ba**
- Aláírás verifikálva: `apksigner verify --print-certs` → `CN=Rentivo`, SHA-256 `ad5268dd3f6c…`

### Design — „ink-first" (Roli választása 3 irány közül)
<!-- NÉVVÁLTÁS (2026-08-05): az irány belső neve tartalmazta a „luxury" szót.
     A design maga (visszafogottság, ink-first, EGY akcentus, valódi tipográfia)
     változatlanul érvényes — csak a NÉV ment el, mert a dokumentumokból újra és
     újra visszaszivárogtatta a törölt pozicionálást a copyba. Ne nevezd vissza. -->

A gyökér-diagnózis: chrome-túlsúly (3 vezérlősor a tartalom előtt), narancs-infláció (7+ narancs elem/képernyő), 2016-os „kép a kártyában" minta, badge-leves.

Implementálva:
- **Meztelen kártyák** — `ListingCard.tsx`: nincs doboz/border, edge-to-edge fotó `Radius.xl`-lel, kategória-badge törölve, zöld badge → sötét üveg-pill amber flash-sel, policy-sor ki, magasabb képek (grid 165 / full 230).
- **Szín-fegyelem** — narancs KIZÁRÓLAG a primary CTA-n és az aktív tabon. Minden aktív chip/toggle `C.text` fill + `C.background` szöveg (auto-témázó ink-minta): `CategoryPill`, explore sortPill, Search List/Map toggle, nyelvi chipek (mind3 profilon).
- **Chrome-csökkentés** — Explore duplikált sort-sáv **törölve** (a filter-sheet-ben megmaradt), szekció-fejlécek ikon nélkül, „See all" szürke, `StarRating` csillag ink, `TierBadge` doboz+emoji → kis színes caps felirat, trending chipek neutrálisak.
- **Manrope brand-font** (`@expo-google-fonts/manrope`, betöltve `app/_layout.tsx`-ben) minden címsoron + áron. `constants/colors.ts` → új `Fonts` export + `Typography` skála `fontFamily`-vel.
- **Floating tab dock** — mind a 3 layoutban (`(consumer)`, `(host)`, `(operator)`): `marginHorizontal: 14, marginBottom: 26, height: 64, borderRadius: 26`, surface bg + hairline border + puha árnyék. **Fontos:** `position:'absolute'` NEM működik (a navigátor felülírja) — margin-alapú a helyes megoldás. A `ListingPreviewSheet` `bottom: 100`-ra állítva, hogy elkerülje a dockot.
- **Emoji-purge** — i18n + profil-labelek (`🌙 ⚠️ 🆔 💳 🛡 🗑 🔍 🚗 🔗`), zászlók a nyelvi chipekről.
- Dark mode külön verifikálva (mély navy + világos ink-pillek) — minden szövegtoken AA kontraszton mindkét témában.

### Emulátor-felbontás (Roli két panasza egy gyökérrel)
„Kiegyenesedő körvonalak" + „rossz felbontású képek" oka: az emulátor **320×640 / 160 dpi** (ldpi) volt.
```powershell
adb shell wm size 1080x1920
adb shell wm density 440
```
Reboot után is megmarad, amíg `wm size reset` nincs. **Az adb tap-koordináták ehhez skálázandók** (tab bar y≈1750–1800, CTA-k y≈1450–1600).

### Play Store asset pack
`C:\projects\Rentivo\store-assets\` (és `C:\projects\newbot\store-assets\`):
`play-icon-512.png`, `feature-graphic-1024x500.png`, 4× `store-shot-*.png` (1080×1920, navy/amber keretes, Inter tipó), `store-listing.md` (app-név, rövid + teljes leírás EN **és** HU, kategória, tag-ek).
A screenshotok natív 1080p forrásból, 9:16 telefon-kerettel (a korábbi 1:2 keret croppolta a széleket — javítva).

---

## 3. TESZT-ÁLLAPOT

| Futás | Eredmény |
|---|---|
| Maestro run (design v2) | **20/20 PASSED** — 20m5s |
| Maestro run (ink-first pass) | **20/20 PASSED** — 20m3s |
| Maestro run (Manrope) | 19/20 — flow 15 flake, **retry zöld** |
| Maestro run (dock) | 19/20 — **flow 10 (Booking) FAILED**, 3m41s timeout ⚠️ |
| Maestro run (release APK) | **futott a session végén — ellenőrizni!** |

**Flow 10 gyanú:** a floating dock miatt a booking bottom-sheet / dátum-picker gomb elcsúszhatott, vagy sima flake (a 15-ös is az volt). Kézi ellenőrzés kell: listing detail → „Select dates" → picker megnyílik-e.

---

## 4. KÖRNYEZET / PARANCSOK (kritikus, ne kelljen újra felfedezni)

```powershell
# adb
$adb = 'C:\Users\waxee\AppData\Local\Android\Sdk\platform-tools\adb.exe'

# Gradle build — MINDIG ez a 3 env kell
Set-Item Env:JAVA_HOME 'C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot'   # JDK25 töri a Kotlin DSL-t!
Set-Item Env:ANDROID_HOME 'C:\Users\waxee\AppData\Local\Android\Sdk'
Set-Item Env:SENTRY_DISABLE_AUTO_UPLOAD 'true'                               # különben sentry.gradle:149 elhasal
# Hosszú buildet MINDIG Start-Process -RedirectStandardOutput-tal indíts (az MCP shell 60s-nél timeoutol)

# Screenshot (PowerShell '>' KORRUPTÁLJA a binárist — csak így!)
& $adb shell screencap -p /sdcard/s.png; & $adb pull /sdcard/s.png C:\projects\newbot\_qa\x.png
# majd: device_stage_files → Read

# Fájlírás ékezetes tartalommal (Set-Content mojibake-et csinál!)
[System.IO.File]::WriteAllText($p, $c, (New-Object System.Text.UTF8Encoding($false)))

# Metro
Start-Process cmd '/c','npx expo start --port 8081 > C:\projects\newbot\_qa\metro.log 2>&1' -WorkingDirectory C:\projects\Rentivo -WindowStyle Hidden
```

**Tanulság:** új modul-fájl (pl. LeafletMap) nem jön át fast refresh-sel → `am force-stop` + újraindítás kell. A `device_stage_files` csak connected folderből (`C:\projects\newbot`, `C:\projects\Rentivo`) tud staged-elni.

---

## 5. NYITOTT ÜGYEK (nem gépi / Roli köre)

1. **Play Console fiók** + `.aab` feltöltés (25 USD egyszeri).
2. **Privacy policy publikus URL** — Play-kötelező. A szöveg megvan az appban, csak hosztolni kell (~10 perces statikus oldal, ezt Claude meg tudja csinálni, csak domain-döntés kell).
3. **Stripe live KYC** — 3 dashboard-lépés, API-ból nem megkerülhető.
4. **EAS publishable key** frissítés.
5. **Hivatalos support email / sender domain** (a store listinghez és az outreach-hez is).
6. **3 Gmail draft** kiküldése (Marbella Cars, Five Star Rentals, Nautica Marbella) — a disztribúció áll, a termék nem kifogás többé.

---

## 6. COMMIT-JAVASLAT

83 fájl módosítva/új, **semmi nincs commitolva**. Branch: `feat/payments-deposit-model-b` (nem main!).

Commit előtt ellenőrizd, hogy ezek **NEM** mennek be:
- `android/keystore.properties`, `android/app/rentivo-release.keystore` (gitignore-ban, de nézd meg: `git status --short | Select-String keystore`)
- gyökérben heverő `.png` teszt-screenshotok (`01-…20-*.png`, `_qa_tmp.png`), `.e2e-shots/`

Javasolt bontás:
```
feat(design): ink-first redesign + Manrope brand type + floating tab dock
feat(map): Leaflet WebView map with price pins (Search + Explore)
chore(release): own upload keystore + signing config
chore(store): Play Store asset pack + EN/HU listing copy
```

---

## 7. KONTEXTUS A SZEMÉLYRŐL / MUNKAMÓDRÓL

- **Rentivo = az egyetlen aktív bevételi vonal** („fullfókusz"). Minden más parkolóban.
- Roli **autonóm végigvitelt** kér: diagnózis → döntés → implementáció → verifikáció, engedélykérés nélkül. Ha akadály van, az megoldandó feladat, nem megállás.
- **Mért állítások kellenek**, nem tippek. Forrásjelölés: `[REPO] (fájl:sor)`, `[DEPLOY]`. Ha nem mért → „feltevés" címke. Becslés csak sávban.
- Screenshot-verifikáció minden vizuális változtatás után — Roli telefonról nézi, és az apró csúszásokat is észreveszi.
- Nyelv: magyar.
