export const Config = {
  supabaseUrl:      process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  // Key migration (legacy anon -> new publishable). Prefer the new publishable
  // key; fall back to the legacy anon key so nothing breaks while BOTH are live
  // on Supabase. Field name kept as `supabaseAnonKey` to avoid call-site churn
  // (lib/supabase.ts, lib/api/*). Client-safe: publishable key is meant to ship.
  supabaseAnonKey:  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  stripeKey:        process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
  apiUrl:           process.env.EXPO_PUBLIC_API_URL ?? 'https://api.rentivo.domrol.com',
  appName:          process.env.EXPO_PUBLIC_APP_NAME ?? 'Rentivo',
  platformCut:      parseFloat(process.env.EXPO_PUBLIC_PLATFORM_CUT ?? '0.10'),
  useMock:          process.env.EXPO_PUBLIC_USE_MOCK === 'true',
  // Google Maps gate. react-native-maps' <MapView> HARD-CRASHES at mount when the
  // native com.google.android.geo.API_KEY is absent from the build (RuntimeException:
  // "API key not found"). Keep maps OFF unless a key actually shipped: set
  // EXPO_PUBLIC_MAPS_ENABLED=true in the EAS build profile env IN TANDEM with adding
  // the native key to app.json (android.config.googleMaps.apiKey). Fail-safe: default
  // false, so a keyless build renders list/placeholder fallbacks instead of crashing.
  mapsEnabled:      process.env.EXPO_PUBLIC_MAPS_ENABLED === 'true',
}
