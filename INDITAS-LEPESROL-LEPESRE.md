# RENTIVO INDÍTÁS — kattintásról kattintásra
**Nincs benne döntés. Csak csináld sorban. Fáradt fejjel is megy.**

Becsült idő: ~90 perc, aminek a fele várakozás.
Kezdd bármelyik blokkal — függetlenek egymástól.

---

## BLOKK 1 — A három email (2 perc, ezzel kezdd)

Ez a legrövidebb és ez a legfontosabb. A draftok már meg vannak írva.

1. Nyisd meg a Gmailt → **Piszkozatok**
2. Ott van 3 megkezdett levél (Marbella Cars, Five Star Rentals, Nautica Marbella)
3. Mindháromnál: olvasd át egyszer, **ne írd át**, nyomj **Küldés**

> Ha elakadsz azon, hogy „még nem elég jó a szöveg" — az a halogatás hangja. A cold email célja nem a tökéletesség, hanem a válasz. Küldd el.

**Kész:** ☐

---

## BLOKK 2 — Stripe live KYC (~15 perc)

1. `dashboard.stripe.com` → jelentkezz be a Rentivo fiókkal
2. Bal felül váltsd a kapcsolót **Test mode → Live mode**-ra
3. Fent megjelenik egy sáv: „Activate your account" / „Complete your profile" → kattints rá
4. Töltsd ki sorban, amit kér:
   - Üzleti forma (egyéni vállalkozó / cég — amid van)
   - Adószám / vállalkozói igazolvány szám
   - Személyazonosító okmány feltöltése (fotó a személyidről vagy útlevélről)
   - Bankszámlaszám a kifizetésekhez (IBAN)
   - Üzleti leírás: *„Peer-to-peer rental marketplace for vehicles, boats and properties on the Costa del Sol."*
5. Küldés → a jóváhagyás általában 1–2 munkanap

> Ha valamelyik mezőnél elbizonytalanodsz, hagyd ki és menj tovább — a legtöbb visszamenőleg pótolható. A cél, hogy elinduljon a folyamat.

**Kész:** ☐

---

## BLOKK 3 — Google Play Console (~45 perc, fele várakozás)

### 3/a — Fiók
1. `play.google.com/console` → Sign up
2. Válaszd: **Personal** (gyorsabb, mint a szervezeti — később átváltható)
3. Fizesd ki a **25 USD** egyszeri regisztrációs díjat (bankkártya)
4. **Személyazonosság-ellenőrzés**: okmány feltöltése. Ez órákat vagy 1-2 napot vehet igénybe — **indítsd el most, és menj tovább a többi blokkra.**

> ⚠️ Új fejlesztői fiókoknál a Google gyakran előír egy zárt tesztelési szakaszt tesztelőkkel, mielőtt élesbe kerülhet az app. Ha ez feljön a képernyőn, ne ijedj meg — olvasd el, mit kér, és jelezd nekem, összerakom hozzá a lépéseket.

### 3/b — App létrehozása
1. **Create app**
2. App name: `Rentivo`
3. Default language: **English (United States)**
4. App or game: **App**
5. Free or paid: **Free**
6. Pipálj be minden nyilatkozatot → **Create app**

### 3/c — Store listing (a szövegek készen vannak)
Nyisd meg a `store-assets/store-listing.md` fájlt, és másold be:

| Mező | Honnan |
|---|---|
| App name | `Rentivo: Luxury Rentals` |
| Short description | a fájl „Short description — EN" sora |
| Full description | a fájl „Full description — EN" blokkja |
| App icon | `store-assets/play-icon-512.png` |
| Feature graphic | `store-assets/feature-graphic-1024x500.png` |
| Phone screenshots | mind a 4 `store-shot-*.png` |
| Category | Travel & Local |

### 3/d — Kötelező űrlapok (menj végig rajtuk, mind rövid)
- **Privacy policy URL** ← ⚠️ **ehhez publikus link kell.** Szólj, és 10 perc alatt kirakom neked egy statikus oldalra a meglévő szöveget.
- **App access**: ha kell belépés a teszteléshez, add meg a demo fiókot
- **Content rating**: kitöltesz egy kérdőívet, pár perc
- **Target audience**: 18+
- **Data safety**: mit gyűjt az app (email, név, helyadat, fizetési adat — Stripe-on keresztül)
- **Ads**: nincs

### 3/e — Feltöltés
1. Bal menü → **Testing → Internal testing** (ezzel kezdj, nem production!)
2. **Create new release**
3. Húzd be: `android/app/build/outputs/bundle/release/app-release.aab`
4. Release name: `1.0.0`
5. Release notes: `Első kiadás.`
6. **Save → Review release → Start rollout to Internal testing**

> Az internal testing azonnal él, nincs review-várakozás. Fel tudod tenni a saját telefonodra, meg tudod mutatni az operátoroknak. A production rollout jöhet utána.

**Kész:** ☐

---

## HA ELAKADSZ

Ne kezdj el debugolni egyedül fáradtan. Írd meg nekem, hogy melyik pontnál, mit ír ki a képernyő — és megoldom.

---

## AMI EZZEL MEGVAN

Ha ez a három blokk kész, akkor van:
- élő app, telepíthető linkkel
- működő élő fizetési lánc
- 3 elindított beszélgetés potenciális partnerekkel

Ez a különbség „építek valamit" és „van egy termékem a piacon" között. Egy délután.
