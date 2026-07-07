# App Store Submission Guide

## iOS SUBMISSION CHECKLIST

### Technikai követelmények (2026)
- [ ] iOS 26 SDK (kötelező 2026 április óta)
- [ ] Privacy Manifest (PrivacyInfo.xcprivacy) — MINDEN SDK-hoz
- [ ] Account deletion in-app (Settings → Delete Account)
- [ ] Demo account az App Review Notes-ban:
      Email: demo@rentivo.com / Jelszó: DemoRentivo2026!
- [ ] App Privacy labels pontosan kitöltve
- [ ] Privacy Policy URL: rentivo.domrol.com/legal/privacy (ÉL)
- [ ] Support URL: rentivo.domrol.com
- [ ] Age Rating: 4+

### EAS Build konfiguráció
```bash
npx eas-cli build --profile preview --platform ios
npx eas-cli build --profile production --platform ios
npx eas-cli submit --platform ios
```

### Screenshots (Roli készíti)
Kötelező:
- 6.7" iPhone (1290×2796): 3-5 db
- 6.5" iPhone (1242×2688): 3-5 db
Ajánlott: iPad Pro 12.9"

Javasolt screenshot sorrend:
1. Map nézet Marbellával + árbuborékok
2. BMW 3 Series listing detail
3. Fleet Calendar (operator WOW screen)
4. My Trips — BMW Confirmed
5. Team Management

### Rejection prevention
- DEMO LOGIN az App Review Notes-ban (legfőbb rejection ok)
- Account deletion gomb elérhető settings-ből
- Backend LIVE és stabil review alatt
- Nincs "Coming Soon" funkció az első képernyőkön

## GOOGLE PLAY CHECKLIST
- [ ] Android 14+ (API 34) target
- [ ] Data Safety form kitöltve (parity Apple Privacy labels-szel)
- [ ] Account deletion webhook URL (Google követelmény)
- Egyszeri regisztrációs díj: $25

## METADATA (kész)

**App neve:** Rentivo — Rent Anything
**Subtitle:** Cars, Villas & More
**Category:** Travel (primary), Business (secondary)
**Age Rating:** 4+

**Description (EN):**
Rentivo is Europe's premium rental marketplace — connecting travelers
with verified operators and private hosts for cars, villas, boats, and more.

FOR TRAVELERS:
- Browse verified rentals across Europe
- Book instantly or request approval
- Secure Stripe payments
- Real-time messaging
- Loyalty points

FOR OPERATORS & HOSTS:
- List your fleet in minutes
- Fleet calendar management
- Team access control
- Instant Stripe payouts

**Keywords:** car rental,villa rental,vacation rental,europe,marketplace,booking

**Privacy Policy:** https://rentivo.domrol.com/legal/privacy
**Support:** https://rentivo.domrol.com
