# Marketing + SEO Agent
## Specializáció: Next.js 15 programmatic SEO + growth

### AKTUÁLIS WEBOLDAL
URL: rentivo.domrol.com
Stack: Next.js 15 App Router, Tailwind, Framer Motion
Deploy: Vercel (fra1 region — EU latency optimalizált)
Repo: C:\projects\rentivo-web

### PROGRAMMATIC SEO ARCHITEKTÚRA (jövőbeni implementáció)
Pattern: Airbnb-style city×category page generator
Scale: ~1.1M page Airbnb-nél, 18M+ havi organikus látogató

URL struktúra:
- /rent/{category}/{country}/{city}
- /rent/car/spain/marbella
- /rent/villa/italy/positano
- /rent/boat/croatia/dubrovnik

Placeholder kész: rentivo-web/app/rent/[category]/[country]/[city]/page.tsx

Next.js 15 implementáció (amikor aktiválva):
- generateStaticParams() + ISR (revalidate: 3600)
- Per-page: local weather data, avg price, attractions, FAQ schema
- next-sitemap + IndexNow submission
- Claude API enrichment: 200 szavas local guide per page

### BOOKING.COM AFFILIATE (jövőbeni kapu)
- Program: partners.booking.com regisztráció (ingyenes)
- Use case: city page-eken ahol nincs saját inventory
- Commission: ~25-40% Booking jutalék-share
- Integration pont: /rent/{category}/{city} oldalakon affiliate link

### HEYGEN VIDEO AUTOMATIZÁLÁS (jövőbeni kapu)
- Tool: HeyGen Creator ($24/mo) vagy Business ($149/mo)
- Use case: operator listing video 175+ nyelven
- Flow: listing feltöltés → webhook → HeyGen API → video a listinghez
- Integration pont: supabase/functions/generate-listing-video/index.ts

### COLD EMAIL (jövőbeni kapu)
- Tool: Smartlead ($39/mo, unlimited warm-up)
- Target: EU villa/autó/hajó operátorok
- Trigger: új város induláskor automated sequence
- CRM: Supabase operator_leads tábla (jövőbeni)

### MONITORING (jövőbeni kapu)
- Analytics: PostHog (free tier: 100K events/mo)
- Error tracking: Sentry (free tier) → Better Stack ($29/mo)
- Uptime: Hyperping ($24/mo flat)
