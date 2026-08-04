# Google Play — Data Safety nyilatkozat (Rentivo)

**Kitöltési segédlet, a kódból levezetve.** Minden sor mögött konkrét fájl áll, nem feltételezés.

> **Miért kritikus, hogy ez egyezzen:** a Play a Data Safety űrlapot összeveti az adatvédelmi
> tájékoztatóval és az app tényleges viselkedésével. Eltérés esetén elutasítás, súlyosabb esetben
> fiókfelfüggesztés. A tájékoztató kanonikus forrása: `constants/legal.data.mjs` → `public/legal/privacy/`.

---

## 0. Előfeltétel — ezt előbb töltsd ki

Az adatkezelő azonosítója még placeholder (`LEGAL_ENTITY` a `constants/legal.data.mjs`-ben):
teljes név, székhely, EV nyilvántartási szám, adószám. Amíg ez nincs kitöltve, se a
tájékoztató, se ez az űrlap nem adható be.

---

## 1. Adatbiztonsági alapkérdések

| Kérdés | Válasz | Bizonyíték |
|---|---|---|
| Titkosított-e az adat továbbítás közben? | **Igen** | Minden hálózati hívás HTTPS (Supabase, Stripe, Didit, Resend, Anthropic). Nincs `http://` végpont a kódban. |
| Kérhetik-e a felhasználók az adataik törlését? | **Igen** | `supabase/functions/delete-account` + `app/(consumer)/profile/delete-account.tsx` |
| Független biztonsági auditon átesett? | **Nem** | Ne állítsd, ha nem történt meg. |
| Play Families Policy | **Nem alkalmazandó** | Az app 18+; bérléshez érvényes vezetői engedély kell. |
| Adat gyűjtése kötelező-e a használathoz? | Részben — lásd lentebb az „Opcionális" jelöléseket. |

**Fontos fogalmi különbség:** a Play szerint a *„megosztás" (sharing)* harmadik félnek való
továbbítást jelent. A nevünkben, utasításunkra eljáró **adatfeldolgozók** (Stripe, Supabase,
Didit, Anthropic, Resend, Expo, Sentry) **nem** számítanak megosztásnak. Ezért az alábbi
táblázatban minden sor „Megosztva: Nem" — de a tájékoztatóban mindegyik nevesítve van.

---

## 2. Gyűjtött adattípusok

### Személyes adatok

| Adattípus | Gyűjtve | Megosztva | Cél | Kötelező | Forrás |
|---|---|---|---|---|---|
| Név | Igen | Nem | App-működés, fiókkezelés | Kötelező | `guest_name` — `create-booking` |
| E-mail cím | Igen | Nem | App-működés, fiókkezelés | **Opcionális** | `guest_email` nullable |
| Telefonszám | Igen | Nem | App-működés (az üzemeltető eléri a bérlőt) | Kötelező | `guest_phone` |
| Felhasználói azonosítók | Igen | Nem | App-működés, fiókkezelés | Kötelező | Supabase `auth.users` |
| Egyéb személyes adat | Igen | Nem | **Csalásmegelőzés, megfelelés** | Opcionális | Okmány típusa/száma, név, **születési dátum**, lejárat — `didit-webhook`, `rentivo_identity_verifications` |

> A **születési dátumot** külön jelöld. Google Play a „Personal info → Other" alá kéri, és a
> csalásmegelőzés/megfelelés célt kell megadni, nem az app-működést.

### Pénzügyi adatok

| Adattípus | Gyűjtve | Megosztva | Cél | Kötelező |
|---|---|---|---|---|
| Vásárlási előzmények | Igen | Nem | App-működés | Kötelező |
| Fizetési adatok | **Nem** | — | — | — |

> A kártyaszám **soha nem ér a szervereinkhez** — a Stripe `CardField` közvetlenül gyűjti
> (`app/(consumer)/booking/[listingId].tsx`). A Play útmutatója szerint ilyenkor a fizetési adat
> gyűjtését **nem** kell bejelenteni. A `payment_intent_id`-t igen, de az azonosító, nem fizetési adat.

### Hely

| Adattípus | Gyűjtve | Megosztva | Cél | Kötelező |
|---|---|---|---|---|
| Hozzávetőleges hely | Igen | Nem | App-működés (közeli járművek a térképen) | **Opcionális** |
| Pontos hely | **Nem** | — | — | — |

> `lib/hooks/useLocation.ts` — `expo-location`. Az engedély megtagadható, az app működik nélküle.
> Ha a kód `Accuracy.High`-ot kér, azt **pontos helyként** kell bejelenteni — ellenőrizd a hívást,
> és ha nem indokolt, vidd le `Accuracy.Balanced`-re, hogy a hozzávetőleges bejelentés igaz maradjon.

### Fotók és videók

| Adattípus | Gyűjtve | Megosztva | Cél | Kötelező |
|---|---|---|---|---|
| Fotók | Igen | Nem | App-működés, **csalásmegelőzés** | Kötelező a kárfelmérési folyamathoz |

> Két külön forrás: hirdetésfotók (`app/(host)/listings/new.tsx`) és **kárfelmérési fotók**
> átvételkor/visszaadáskor (`components/damage/PhotoCapture.tsx` → `lib/storage.ts`).
> A kárfotókat az **Anthropic** is megkapja elemzésre (`damage-detector`) — a tájékoztatóban nevesítve.

### Üzenetek

| Adattípus | Gyűjtve | Megosztva | Cél | Kötelező |
|---|---|---|---|---|
| Egyéb alkalmazáson belüli üzenetek | Igen | Nem | App-működés | Opcionális |

> `app/(consumer)/bookings/chat/[bookingId].tsx`. Az üzenetek **fordítás céljából** az Anthropichoz
> kerülnek (`translate-message`), és az AI-asszisztens beszélgetései szintén (`rental-assistant`).

### App-tevékenység és teljesítmény

| Adattípus | Gyűjtve | Megosztva | Cél | Kötelező |
|---|---|---|---|---|
| Összeomlási naplók | Igen | Nem | Analitika (hibakeresés) | Kötelező |
| Diagnosztika | Igen | Nem | Analitika | Kötelező |
| Egyéb app-tevékenység | Igen | Nem | App-működés | Opcionális |

> Sentry (`lib/sentry.ts`) — csak DSN megléte esetén aktív. Az „egyéb app-tevékenység" a helyben
> tárolt keresési előzmény (`rentivo_search_history`).

### Eszközazonosítók

| Adattípus | Gyűjtve | Megosztva | Cél | Kötelező |
|---|---|---|---|---|
| Eszköz- vagy egyéb azonosítók | Igen | Nem | App-működés (push-értesítés) | **Opcionális** |

> Expo push token (`lib/notifications.ts`). Az értesítési engedély megtagadható.

---

## 3. Amit NEM gyűjtünk — ne pipáld be

Ellenőrizve, egyik sem szerepel a kódban: névjegyek · naptár · SMS/hívásnapló · hangfájlok ·
zene · egészség és fitnesz · böngészési előzmény · telepített appok listája · faji vagy etnikai
származás · politikai vélemény · szexuális irányultság · hirdetésazonosító (nincs reklám-SDK).

---

## 4. Biometria — külön figyelmeztetés

A személyazonosság-ellenőrzés arcképet és élőségvizsgálatot végez a **Didit**nél.

- A **nyers biometrikus adat nem érkezik meg hozzánk** — csak az arcegyezési pontszám és az
  élőség-eredmény (`didit-webhook`, 121–128. sor). Ez ellenőrzött tény, nem feltevés.
- A Play Data Safety űrlapján ehhez nincs külön „biometrics" kategória; a
  **„Personal info → Other"** alatt jelentsd, **csalásmegelőzés** céllal.
- A GDPR viszont 9. cikk szerinti különleges adatként kezeli → **kifejezett hozzájárulás kell**
  az ellenőrzés indítása ELŐTT. Ellenőrizd, hogy a `profile/identity-verification` képernyő
  ezt külön bekéri, nem az általános ÁSZF-elfogadásba csomagolva.

---

## 5. Store listing kötelező URL-ek

| Mező | Érték |
|---|---|
| Privacy policy URL | `<a publikált /legal/privacy URL>` — még nincs élesítve |
| Adatkezelő neve | `LEGAL_ENTITY.legalName` — még placeholder |
| Support e-mail | `privacy@rentivo.app` — **ellenőrizd, hogy valóban fogad levelet** |
| Kategória | Travel & Local |
| Célközönség | 18+ |

---

## 6. Beadás előtti ellenőrzőlista

- [ ] `LEGAL_ENTITY` kitöltve valós adatokkal
- [ ] `node scripts/build-legal.mjs` lefuttatva, az oldalak publikálva
- [ ] A privacy URL böngészőből, bejelentkezés nélkül megnyílik
- [ ] A support e-mail cím létezik és fogad levelet
- [ ] A helymeghatározás pontossága egyezik a bejelentéssel (`Accuracy.Balanced` = hozzávetőleges)
- [ ] Az identitás-ellenőrzés külön, kifejezett hozzájárulást kér
- [ ] A Data Safety űrlap és a tájékoztató feldolgozói listája ugyanaz a nyolc szolgáltató
