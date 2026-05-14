export const Config = {
  supabaseUrl:      process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey:  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  stripeKey:        process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
  apiUrl:           process.env.EXPO_PUBLIC_API_URL ?? 'https://api.rentivo.domrol.com',
  appName:          process.env.EXPO_PUBLIC_APP_NAME ?? 'Rentivo',
  platformCut:      parseFloat(process.env.EXPO_PUBLIC_PLATFORM_CUT ?? '0.025'),
  useMock:          process.env.EXPO_PUBLIC_USE_MOCK === 'true',
}
