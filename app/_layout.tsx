import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StripeProvider } from '@stripe/stripe-react-native'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { supabase } from '@/lib/supabase'
import { STRIPE_PUBLISHABLE_KEY } from '@/lib/stripe'

export default function RootLayout() {
  const { setSession } = useAuthStore()

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session as Record<string, unknown> | null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session as Record<string, unknown> | null),
    )
    return () => subscription.unsubscribe()
  }, [setSession])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder'}>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }} />
        </StripeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
