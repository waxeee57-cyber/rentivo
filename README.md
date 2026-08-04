# Rentivo — mobil app

Rövidtávú bérlés-piactér React Native + Expo alapon. Három szereplő:
**Traveler** (bérel), **Host** (magánszemély, C2C), **Operator** (profi vállalkozó, B2C).
Backend: Supabase (Postgres + Edge Functions). Fizetés: Stripe Connect.

## Indítás

```bash
npm install
cp .env.example .env     # majd töltsd ki a kulcsokat (soha ne commitold)
npm start                # expo start — QR kód Expo Go-hoz
```

Platformonként:

```bash
npm run android
npm run ios
npm run web
```

Backend nélküli próbához: `EXPO_PUBLIC_USE_MOCK=true` a `.env`-ben.

Tunnel-es tesztelés fizikai eszközön: `npx expo start --tunnel`.

## Tesztek

```bash
npm run test:e2e           # összes maestro flow
npm run test:e2e:smoke     # smoke tag
npm run test:e2e:critical  # critical tag
npm run itest:payments     # fizetési integrációs script
npm run test:booking       # foglalási flow script
npx tsc --noEmit           # típusellenőrzés — 0 error a követelmény
```

## Deploy

EAS Build (`eas.json`):

```bash
eas build --profile preview      # internal distribution, channel: preview
eas build --profile production   # store distribution, channel: production
```

- iOS: production → store, `m-medium` resource class
- Android: preview → APK, production → app-bundle

A `submit.production` blokk iOS mezői még placeholderek
(`YOUR_APPLE_ID`, `YOUR_APP_STORE_CONNECT_APP_ID`, `YOUR_TEAM_ID`) — kitöltendő az
első store submit előtt. Android submit a `google-play-service-account.json`-t várja
(gitignore-olva), track: `internal`.

Titkok build-time: EAS Secrets. A repo `.env`-je nem kerül a buildbe.

## Live URL

> TODO: ismeretlen — pótolni: nincs a repóban store-listing vagy publikált build URL.
> A `.claude/CLAUDE.md` a webes párt `rentivo.domrol.com`-ként említi, a
> `constants/config.ts` API default-ja `https://api.rentivo.domrol.com` —
> de ez a mobil app store-linkjét nem igazolja.

## Kapcsolódó

- Web: `C:\projects\rentivo-web`
- Agent-doksi: `CLAUDE.md` (gyökér) + `.claude/CLAUDE.md` (részletes szabályok)
- Követelmények: `docs/requirements.md`, auditok: `docs/audits/`
