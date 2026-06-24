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
}
