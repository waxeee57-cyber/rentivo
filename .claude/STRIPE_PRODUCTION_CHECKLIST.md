# Stripe Connect Production Activation Checklist

## STÁTUSZ: PENDING
Aktiválás előtt minden pont teljesítendő.

## LÉPÉSEK

### Dashboard beállítások (manuális — Roli csinálja)
- [ ] Stripe Dashboard → Platform profile complete
- [ ] Business name: DomRol Kft.
- [ ] Brand settings: Rentivo logo + colors (#E8A44A)
- [ ] Support URL: rentivo.domrol.com
- [ ] Privacy Policy URL: rentivo.domrol.com/legal/privacy
- [ ] Terms URL: rentivo.domrol.com/legal/terms

### KFT regisztráció (manuális)
- [ ] KFT alapítási dokumentumok feltöltve
- [ ] EU VAT szám (ha van)
- [ ] Bank account HU vagy EU

### Technikai (Claude Code implementálja)
- [ ] Live publishable key → Vercel env var
- [ ] Live secret key → Vercel env var + EAS env var
- [ ] Webhook endpoint live: /api/stripe/webhook
- [ ] Webhook events: checkout.session.completed, account.updated, payout.paid
- [ ] Destination charges implementálva
- [ ] Capability polling: transfers.status === "active" before payout
- [ ] SCA/3DS2: Stripe automatikusan kezeli EU kártyáknál
- [ ] Stripe Tax: enabled

### Testing (manuális)
- [ ] Test mode → Live mode váltás tesztelve
- [ ] Valódi kártyával teszt tranzakció €1 összegben
- [ ] Operator payout teszt
- [ ] Webhook delivery ellenőrzés Stripe Dashboard-ban

### EU Compliance
- [ ] Stripe Tax EU VAT calculation enabled
- [ ] PSD2 SCA: automatikus (Stripe kezeli)
- [ ] GDPR: Stripe adatfeldolgozói megállapodás elfogadva

## FEES MEMÓRIA
- EEA kártyák: 1.5% + €0.25
- UK: 2.5% + €0.25
- Nem-EU: 3.25% + €0.25
- Kifizetés: 0.25% + €0.10
- Express account: €2/hó aktív fiókonként

## INSTANT PAYOUT (jövőbeni kapu)
Lyft pattern: "kapj 1 óra alatt" → 40% adoption 6 hónap alatt
Aktiválás: amikor 20+ aktív operátor van
Hook helye: app/(operator)/profile/index.tsx → Payout settings
