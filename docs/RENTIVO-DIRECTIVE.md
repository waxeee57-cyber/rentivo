# RENTIVO — MŰKÖDÉSI DIREKTÍVA

> Ezt a fájlt egy jövőbeli session kapja meg. Második személyben, parancsban van írva,
> mert utasítás, nem esszé. Minden állítás mögött mért adat van; ahol nincs, ott
> „feltevés" címke áll.

---

## 0. A CÉL — ahogy mérni fogod

**NEM cél:** „2026 legjobb appja". Nem mérhető, nem irányít döntést, és elvonja a
figyelmet arról, ami ténylegesen blokkol.

**A cél, sorrendben. Amíg egy szint nem teljesült, a következőn végzett munka halogatás:**

| # | Kapu | Mérés | Állapot 2026-08-04 |
|---|---|---|---|
| 1 | Publikálható | Play Console fiók + publikus privacy URL + Stripe live KYC | **nincs meg** |
| 2 | Első fizető operátor | 1 operátor, aki `stripe_onboarded = true` és feltöltött ≥3 hirdetést | **0** |
| 3 | Első idegen foglalás | 1 `payment_status='paid'` sor, ahol a `user_id` nem te vagy | **0** |
| 4 | Likviditás | ≥50 aktív hirdetés, ≥3 operátor, egy városban | 5 hirdetés, 1 város |
| 5 | 1 000 USD MRR | Stripe dashboard | — |
| 6 | 5 000 USD MRR | Stripe dashboard | — |

**A kapu, ami MA blokkol: az 1-es.** Nem kódprobléma. Egy statikus privacy oldal
(~10 perc), egy 25 USD-s fiókregisztráció, és három dashboard-kattintás a Stripe-nál.

**Szabály:** ha egy munkanapon kód ment ki, de a fenti táblázat egyetlen sora sem
mozdult, mondd ki a válaszod ELSŐ bekezdésében, hogy a nap nem volt teljes. Ne
puhítsd, ne tedd a végére.

---

## 1. NEM-ALKUKÉPES MÉRNÖKI SZABÁLYOK

Ezek nem stílus. Mindegyik egy 2026-08-04-én **valóban megtalált** hibából származik.

### 1.1 A pénz szerver-autoritatív
- A kliens **soha** nem küld összeget. Küld paramétereket; az árat a szerver a
  *listingből* vezeti le.
- Minden fizetési útvonalon a terhelés előtti utolsó pillanatban újra kell számolni.
  *Miért:* egy meglévő PaymentIntent-et a rendszer az autoritatív összeg kiszámítása
  **előtt** adott vissza — a felhasználó az új árat látta és a régit fizette.
- Ha egy képernyő monetáris ígéretet tesz („100% visszatérítés"), akkor **létezzen a
  kód, ami teljesíti**. Grep-eld le. A lemondás hónapokig 100%-ot ígért, és
  `stripe.refunds.create` nem szerepelt a repóban.

### 1.2 A csendes hiba a legdrágább hiba
- `supabase-js` **nem ad hibát** 0 soros UPDATE-re. Minden mutáció után vagy ellenőrizd
  az érintett sorokat, vagy ne állíts sikert a UI-on.
- Tilos: `catch { return null }` üzleti útvonalon. Az RLS-elutasítás és a „nincs
  találat" nem ugyanaz, és a felhasználó üres képernyőt kap hibaüzenet helyett.
- Tilos: `setTimeout` szimulált munka `Config.useMock` kapu nélkül. Négy ilyen volt,
  mind „mentett" valamit produkcióban, ami sosem került adatbázisba.

### 1.3 Amit a gép meg tud mérni, azt ne szemre nézd
```bash
node scripts/quality-check.mjs          # riport + exit 1 regresszióra
node scripts/quality-check.mjs --update # szándéknyilatkozat, nem takarítás
```
Ez futtasd **minden kör elején és végén**. Ha egy metrika romlik, az vagy hiba, vagy
szándékos — de sosem észrevétlen. Új mechanikus szabályt itt vezess be, ne review-ban.

### 1.4 Sorrend, ami nem opcionális
```
quality-check → kódmódosítás → tsc --noEmit → app újraindítás → Maestro
```
E2E futás alatt **egyetlen fájlt sem írsz**. A Metro hot-reload eltöri a maradék
flow-t, és a hiba úgy néz ki, mintha a termék romlott volna el.

### 1.5 A teszt a szándékra célozzon
Soha ne szelektálj tartalomra, ha az elem azonosítható. A `text: ".*€.*"` selector
(„az első euró-jeles szöveg") némán átcélzott egy nem-kattintható feliratra, amint
egy ár-horgony a feed fölé került — és a bukás úgy jelentkezett, mintha a Foglalás
gomb tűnt volna el. `testID`-t használj.

---

## 2. A BIZTONSÁGÉRZET — konkrétan, nem hangulatként

Autóbérlésnél a szorongás **soha** nem az, hogy „elég elegáns-e". Négy kérdés van,
és mind a négyre a terméknek kell válaszolnia, mielőtt felteszik:

| Félelem | A felület, ami megválaszolja | Állapot |
|---|---|---|
| „Ott lesz egyáltalán az autó?" | Azonnali visszaigazolás + az operátor bizonyítéka (bérlésszám, értékelés) a kártyán | ✅ |
| „Megtartják a kaucióm egy karcért?" | Átvételi/visszaadási fotósor, aláírt szerződés, a kaució pontos plafonja **fizetés előtt** kiírva | ✅ |
| „Mennyit vonnak le pontosan?" | Tételes bontás, ahol a szolgáltatási díj **a valós `platformCut`-ból** számolódik | ✅ (a felirat 2,5%-ot mondott, a rendszer 10%-ot vont) |
| „Kit hívok este 11-kor?" | Az operátor telefonszáma az aktív foglalásban, egy koppintásra | ✅ |

**Szabály:** minden új funkciónál nevezd meg, melyik félelmet csökkenti. Ha egyikét
sem, akkor az funkció-hízás, és a válaszodban mondd ki, hogy az.

**Bizonyíték > állítás.** A „luxus", „prémium", „megbízható" önjellemzés — ingyen van,
és pont ezért nem hisznek neki. A „412 bérlés · 4,9★" és a „kaució felső határa €0"
ellenőrizhető. A mérés: a repóban 12:1 az arány a bizalmi nyelv javára — ezt tartsd.

---

## 3. DESIGN-SZERZŐDÉS

- **Egy betűtípus, minden szövegen.** `fontFamily: Fonts.*` a `fontWeight` **helyett**,
  soha nem mellette (Android fals-boldot szintetizál egy eleve bold arcra).
  *Miért kell leírni:* a token létezett, és 342 címsorból 24 használta. Az app Robotóban ment.
- **A narancs kizárólag a primary CTA-n és az aktív tabon.** Minden más aktív állapot
  `C.text` kitöltés + `C.background` szöveg.
- **Egy alsó sáv.** Deep screenen a dock eltűnik. Két versengő alsó sáv a fő CTA felett
  nem stílus kérdése, hanem hiba.
- **Nincs színes emoji ikonként.** Tipográfiai jelek (→ ✓ ★ ·) maradnak.
- **AA kontraszt minden token-páron**, mindkét témában. A kapu kiszámolja; ne becsüld.
- **A kirakat mutassa a teljes skálát.** Az onboarding hero forogjon a kínálaton, és
  legyen „from €X/day" horgony a hajtás felett. Egyetlen villa-fotó úgy szűri ki a
  €25-os bérlőt, hogy egy szót sem olvasott.

---

## 4. AMIT A KÓD NEM TUD MEGOLDANI

Ezt minden session elején olvasd el, mielőtt bármit refaktorálnál.

- **A piactér értéke a likviditás, nem a kódminőség.** 5 hirdetéssel a legszebb app is
  üres kirakat. Egy új operátor felvitele nagyságrendekkel többet ér, mint egy újabb
  audit-kör.
- **A kutatás, felmérés és audit is lehet halogatás.** Ha egy kör nem vezet azonnali
  döntéshez, ne futtasd le — mondd ki, hogy a bevétel-közeli lépés következik.
- **A tökéletesség nem kapu.** A fenti 1-es kapu (publikálhatóság) nem igényel semmilyen
  további kódot. Ha egy sessionben kód íródik, miközben az 1-es kapu nyitva van, azt
  indokold meg — vagy hagyd abba.

---

## 5. AHOGY DOLGOZOL

- **Autonóm végigvitel.** Diagnózis → döntés → implementáció → verifikáció. Reverzibilis
  döntésnél nem kérsz engedélyt. Irreverzibilisnél (adatvesztés, éles migráció ütköző
  adaton, pénzmozgás) megállsz és megnevezed a kockázatot.
- **Mért állítás, vagy „feltevés" címke.** Forrásjelölés `fájl:sor` vagy `[DEPLOY]`.
  Becslés csak sávban.
- **Párhuzamosítás:** fan-out a *keresésre*, szigorú fájl-tulajdonlással a *javításra*.
  A pénz-útvonalat egy szálon tartod — az összefüggést, ami három fájl együttes
  olvasásából jön ki, egy alügynök kontextusa elveszíti.
- **Screenshot csak nyitott vizuális kérdésre.** „Le van fordítva?" nem vizuális kérdés.
- **Kíméletlen visszajelzés kifelé és befelé.** Ha a felhasználó terve nem áll meg a
  saját mérésén, azt az első bekezdésben mondod ki, nem az utolsóban.

---

## 6. A KÖR

```
1. quality-check + git log      → hol tartunk valójában
2. A 0-ás fejezet táblázata     → melyik kapu blokkol
3. Ha az 1–3. kapu nyitva:      → a bevétel-közeli lépés, NEM kód
4. Ha kód kell:                 → mérj, javíts, tsc, E2E, quality-check
5. Commit tematikusan           → az üzenet hordozza a bizonyítékot
6. Zárás                        → mi mozdult a 0-ás táblázatban? Ha semmi: mondd ki.
```

---

**Egy mondatban:** ne a legjobb appot építsd, hanem azt, amit egy marbellai
autókölcsönző holnap reggel be mer kapcsolni, és amit egy turista este 11-kor
nyugodtan kifizet. A többi ebből következik — fordítva nem.
