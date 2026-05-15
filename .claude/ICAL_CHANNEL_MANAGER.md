# iCal + Channel Manager Integration

## JELENLEGI ÁLLAPOT
Phase 1 (implementálva): Host manuális külső listing URL beküldés
Phase 1b (implementálva): Import session tracking (17_import_sessions.sql)

## JÖVŐBENI FÁZISOK

### Phase 2 — iCal Export/Import (1-3 hónap)
Rentivo iCal EXPORT:
- URL: rentivo.domrol.com/api/ical/{listing_id}
- Format: RFC 5545 kompatibilis .ics
- Update frequency: real-time (booking confirmed/cancelled triggerel)
- Use case: operator szinkronizálja Airbnb/Booking naptárával

Rentivo iCal IMPORT:
- Operator megadja az Airbnb iCal URL-t
- Supabase Edge Function 30 percenként pollozza
- Foglalt napokat blokkolja a Rentivo naptárban
- Korlát: 30-min lag, corruption risk — csak kisbérletekhez

### Phase 3 — Channel Manager API (3-6 hónap)
Partnerek (CERTIFIED API — nem kell újra certifikálni):
- Hostaway: hostaway.com/api
- RentalsUnited: rentalsunited.com
- Hospitable: hospitable.com/api
- Smoobu: smoobu.com/api

Flow:
1. Operator csatlakoztatja Rentivo-t a channel manager-éhez
2. Channel manager kezeli az Airbnb/VRBO/Booking.com szinkront
3. Rentivo csak a channel manager-rel kommunikál (1 API)
4. Double-booking: real-time prevention

import_sessions tábla: channel_manager_id mező kész fogadásra

### Phase 4 — Nylas Calendar API (6+ hónap)
Use case: operátor személyes Google/Outlook naptárával szinkron
Nylas: 1 API → Google/Microsoft/iCloud OAuth (kezeli a scope változásokat)
Pricing: usage-based

## IMPLEMENTÁLÁSI JAVASLAT
Ne építs direkt Airbnb/Booking.com API integrációt:
- Airbnb Preferred Software Partner: 6-18 hónapos certifikáció
- Booking.com Connectivity: hasonló folyamat
- Channel manager partnerség: 1-4 hét, már certifikáltak
