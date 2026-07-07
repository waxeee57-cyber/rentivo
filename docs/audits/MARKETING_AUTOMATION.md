# Marketing Automation Kapuk

## HEYGEN — Listing Video Automatizálás

### STÁTUSZ: JÖVŐBENI INTEGRÁCIÓ
Aktiválás: App Store launch után, első 20 operátor onboardingja után

### FLOW
1. Operátor listing feltölt (photos, description, price)
2. Supabase trigger: listing.status → 'active'
3. Edge Function: HeyGen API → listing video generálás
   - Avatar: Rentivo branded presenter
   - Script: listing description-ből
   - Nyelvek: EN + HU + ES automatikusan
   - Hossz: 30 másodperc
4. Video URL visszakerül a listings táblába
5. App: listing detail-en video player megjelenik

### API INTEGRÁCIÓ (amikor aktiválva)
```
Hook helye: supabase/functions/generate-listing-video/index.ts
HeyGen API v2: POST https://api.heygen.com/v2/video/generate
Headers: X-Api-Key: {HEYGEN_API_KEY}
```

### ÁRAZÁS
Creator: $24/mo (korlátozott percek)
Business: $149/mo (korlátlan, 175+ nyelv)

---

## SMARTLEAD — Operator Outreach

### STÁTUSZ: JÖVŐBENI INTEGRÁCIÓ
Aktiválás: Minden új városban való terjeszkedésnél
Ár: $39/mo, unlimited warm-up

### FLOW
1. Új város kiválasztása (pl. Valencia, Athén, Split)
2. Operator lista összeállítása (manuális + LinkedIn)
3. Smartlead sequence: 5 emailes sorozat
   - Email 1: "Rentivo — Európa első profi bérlési marketplace-e"
   - Email 2: CostaSol case study
   - Email 3: Fleet Calendar demo video
   - Email 4: Ingyenes próbaidőszak ajánlat
   - Email 5: Break-up email
4. Válasz → Supabase operator_leads tábla update
5. Hot lead → Roli manuális follow-up

### TRACKING (jövőbeni Supabase tábla)
```sql
CREATE TABLE operator_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT, email TEXT, company TEXT,
  city TEXT, country TEXT, category TEXT,
  status TEXT DEFAULT 'contacted',
  smartlead_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## POSTHOG — Product Analytics

### STÁTUSZ: JÖVŐBENI INTEGRÁCIÓ (App Store launch előtt)
Csomag: Free tier (100K event/mo)

### KRITIKUS EVENTI (amikor implementálva)

**App:**
- app_opened
- search_performed { category, city, date_range }
- listing_viewed { listing_id, category, price }
- booking_started { listing_id }
- booking_completed { listing_id, amount_eur }
- operator_onboarded { city, category }
- language_changed { from, to }

**Web (rentivo-web):**
- page_viewed { path }
- cta_clicked { button, path }
- pricing_viewed
- hu_page_viewed (magyar landing page)
