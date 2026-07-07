# Monitoring Setup Guide

## JELENLEGI ÁLLAPOT: Nincs monitoring

## AJÁNLOTT STACK (prioritás sorrendben)

### 1. Sentry (azonnali — ingyenes)
React Native:
```bash
npm install @sentry/react-native
```
Inicializálás: app/_layout.tsx-ben Sentry.init()
DSN: Sentry.io-n projekt létrehozása után
Kapcsl: SENTRY_DSN env var

Next.js:
```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```
Automatikusan konfigurálja a next.config.ts-t

### 2. Better Stack (~$29/mo — ha Sentry free tier kevés)
- Sentry SDK kompatibilis (drop-in csere)
- Uptime monitoring + on-call
- Log aggregation
- ~1/6-a a Sentry áraknak

### 3. PostHog (product analytics — ingyenes 100K event/mo)
React Native: `npm install posthog-react-native`
Next.js: `npm install posthog-js`

Hook helyek:
- app/_layout.tsx: PostHog.init()
- Booking completed: PostHog.capture('booking_completed', {...})
- Operator onboarded: PostHog.capture('operator_onboarded', {...})
- Language changed: PostHog.capture('language_changed', { from, to })
- Search performed: PostHog.capture('search_performed', { category, city })

### 4. Hyperping ($24/mo flat — uptime + status page)
- rentivo.domrol.com uptime monitoring
- Status page: status.rentivo.domrol.com
- On-call alerts SMS/email
- SLA reporting operátoroknak

## AKTIVÁLÁS SORRENDJE
1. Sentry (most, ingyenes, 30 perc) → bemutató előtt hasznos
2. PostHog (App Store launch előtt) → user behavior tracking
3. Hyperping (launch után) → uptime SLA operátoroknak
4. Better Stack (€5k MRR után) → ha Sentry limit elfogyott
