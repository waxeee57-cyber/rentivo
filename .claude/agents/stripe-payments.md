# Stripe Payments Agent
## Specializáció: Stripe Connect Express + marketplace payments

### JELENLEGI STÁTUSZ
- Stripe Connect: implementálva, LIVE key státusz ellenőrizendő
- Account type: Express (co-branded, Airbnb/Lyft pattern)
- Charge pattern: destination charges

### PRODUCTION CHECKLIST (elvégzendő)
- [ ] STRIPE_SECRET_KEY → live key (Vercel + EAS dashboard-ban manuálisan)
- [ ] STRIPE_PUBLISHABLE_KEY → live key
- [ ] Platform profile complete a Stripe Dashboard-ban
- [ ] Destination charges implementálva transfer_data[destination]-nel
- [ ] Capability check: recipient.capabilities.transfers.status === "active"
- [ ] SCA/3DS2 enabled (kötelező PSD2 alatt EU kártyákhoz)
- [ ] Webhook: checkout.session.completed → Supabase booking update
- [ ] Stripe Tax enabled (EU VAT automatizálás)

### FEE STRUKTÚRA (dokumentált)
- EEA kártyák: 1.5% + €0.25
- UK kártyák: 2.5% + €0.25
- Nem-EU: 3.25% + €0.25
- Kifizetési díj: 0.25% + €0.10
- Express account: €2/hó aktív fiókonként

### JÖVŐBENI KAPUK
- [ ] Stripe Identity KYC — operator onboarding-ba integrálva
  Hook helye: app/(operator)/onboarding/kyc.tsx
  Komponens: components/kyc/KYCGatePlaceholder.tsx (kész)
- [ ] Stripe Instant Payouts — "kapj 1 óra alatt" feature
  Lyft pattern: 40% payout azonnal 6 hónapon belül
  Aktiválás: 20+ aktív operátor után
- [ ] Stripe Radar — payment fraud scoring Supabase trigger-rel
- [ ] Stripe Sigma — SQL alapú MRR/ARR reporting
- [ ] Stripe Tax automatikus EU VAT calculation
- [ ] Stripe Data Pipeline → BigQuery (€1M ARR után)
