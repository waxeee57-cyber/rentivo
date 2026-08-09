# AGENTS.md

Project overview, stack, conventions, and standard run/test commands live in
`README.md`, `CLAUDE.md` (repo root), and `package.json` scripts. Read those
first. This file only captures durable, non-obvious guidance for agents.

## Cursor Cloud specific instructions

This is a React Native + Expo (SDK 54) app. On the headless cloud VM there is no
Android emulator or Xcode, so `npm run android` / `npm run ios` are not usable
here. **Develop and demo via the web target: `npm run web`** (Expo/Metro serves
at `http://localhost:8081`). iOS/Android remain the real product targets — web
is only for local development/verification on this VM.

### Mock mode is required to run without credentials
The app reads `EXPO_PUBLIC_USE_MOCK` (see `constants/config.ts` → `Config.useMock`),
which defaults to **false**, so with no config the app tries a real Supabase
backend and won't work offline. For credential-free dev, ensure a `.env` exists
with at least:

```
EXPO_PUBLIC_USE_MOCK=true
EXPO_PUBLIC_MAPS_ENABLED=false
```

`.env` is gitignored (never committed) and persists in the VM snapshot. If it is
missing, recreate it. In mock mode auth is bypassed (`app/index.tsx` redirects
straight into role dashboards) and all `lib/api/*` calls return `lib/mockData.ts`.
Keep `EXPO_PUBLIC_MAPS_ENABLED=false` — a keyless `<MapView>` hard-crashes on
native; on web it renders a placeholder.

### Web build stubs (already committed in metro.config.js)
Two native/ESM-only modules break the web bundle and are handled by web-only
metro resolver entries in `metro.config.js` (native builds are unaffected):
- `@stripe/stripe-react-native` → `stubs/stripe-react-native.web.js` (imports
  react-native native-only codegen that can't bundle for web).
- `zustand/middleware` → its CJS build (`node_modules/zustand/middleware.js`).
  The ESM build uses `import.meta.env`, which throws at runtime on web because
  Expo serves the bundle as a classic script ("Cannot use 'import.meta' outside
  a module"). The CJS build uses `process.env.NODE_ENV` instead.

If you add a new dependency that either imports react-native internals or uses
`import.meta` in its ESM entry, the web bundle may need a similar web-only stub.

### Lint / quality gate (there is no ESLint)
- Type check (required after every change, 0 errors): `npx tsc --noEmit`.
- Regression gate: `node scripts/quality-check.mjs` (exits non-zero on regression;
  `--update` rewrites the baseline for intentional changes).

### Known web-only quirks (not bugs to fix)
- The booking confirmation voucher shows red text "React Native WebView does not
  support this platform" — `react-native-webview` has no web implementation. The
  booking flow itself completes fine; this is web-only rendering.
- On the booking form (`app/(consumer)/booking/[listingId].tsx`), "Full name" and
  "Phone number" are required; their placeholders look pre-filled but the fields
  are empty, so "Continue to payment" stays disabled until you actually type.

### Tests that need more than mock web dev
`npm run test:e2e*` (Maestro) needs the Maestro CLI + a device/emulator, and
`node scripts/e2e/*` runs against a live deployment with real Stripe/Didit
secrets. Neither runs in plain mock web dev on this VM.
