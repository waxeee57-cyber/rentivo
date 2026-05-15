# City Page Generator Skill
## Programmatic SEO — city×category oldal generálás

### STÁTUSZ: JÖVŐBENI IMPLEMENTÁCIÓ
Aktiválás: amikor 10+ városban van inventory
Placeholder kész: rentivo-web/app/rent/[category]/[country]/[city]/page.tsx

### ARCHITEKTÚRA
Input: Supabase listings tábla (city, category, avg_price, count)
Output: /rent/{category}/{country}/{city} statikus oldalak

### IMPLEMENTÁCIÓ LÉPÉSEI (amikor aktiválva)
1. Supabase view: active_listings_by_city_category
   ```sql
   CREATE VIEW active_listings_by_city_category AS
   SELECT city, country, category, COUNT(*) as count,
     AVG(price_per_day) as avg_price, MIN(price_per_day) as min_price
   FROM listings WHERE status = 'active'
   GROUP BY city, country, category;
   ```

2. Next.js generateStaticParams() — city×category kombinációk
3. ISR: export const revalidate = 3600
4. Per-page metadata: generateMetadata()
5. Schema markup: LocalBusiness + Product + FAQ
6. Claude API enrichment: local guide, FAQ (200 szó/oldal)
7. next-sitemap konfiguráció
8. IndexNow submission webhook

### BOOKING.COM AFFILIATE INTEGRÁCIÓ
Ha count === 0 az adott city-category-ban:
→ Booking.com affiliate link megjelenítése
→ Saját listing CTA: "Legyen te az első operátor {city}-ban"

### BENCHMARK
Airbnb: ~1.1M programmatikus oldal, 18M+ havi organikus látogató
