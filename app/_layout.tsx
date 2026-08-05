import { useEffect, useState, Fragment, useCallback, useMemo } from 'react'
import { useFonts } from 'expo-font'
import {
  Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope'
// Display face, used only on the feed card's title and rate. Two weights, not
// the family: an unused weight is a download nobody asked for.
import { Archivo_700Bold, Archivo_800ExtraBold } from '@expo-google-fonts/archivo'
import * as SplashScreen from 'expo-splash-screen'
import { Ionicons } from '@expo/vector-icons'
import { Stack, router, usePathname } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useThemeStore } from '@/lib/store/useThemeStore'
import {
  GestureHandlerRootView,
} from 'react-native-gesture-handler'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Linking,
} from 'react-native'
import { StripeProvider } from '@stripe/stripe-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Notifications from 'expo-notifications'
import { useAuthStore } from '@/lib/store/useAuthStore'
import type { RentivoUser } from '@/types'
import { useNotificationStore } from '@/lib/store/useNotificationStore'
import { supabase } from '@/lib/supabase'
import { STRIPE_PUBLISHABLE_KEY } from '@/lib/stripe'
import { registerForPushNotifications, savePushToken } from '@/lib/notifications'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { initSentry } from '@/lib/sentry'

SplashScreen.preventAutoHideAsync()
initSentry()
import { t } from '@/constants/i18n'
import { Toast } from '@/components/ui/Toast'
import { OfflineBanner } from '@/components/ui/OfflineBanner'
import { useColors } from '@/lib/hooks/useColors'

function GdprModal({ visible, onAccept, onManage, language }: {
  visible: boolean
  onAccept: () => void
  onManage: () => void
  language: 'en' | 'es' | 'hu'
}) {
  const C = useColors()
  const gdprStyles = useMemo(() => makeGdprStyles(C), [C])
  // The card sits at the bottom of a full-screen Modal, so on notched devices
  // the "Manage Preferences" row landed under the home indicator. The modal is
  // outside the SafeAreaView tree, hence the explicit inset.
  const insets = useSafeAreaInsets()
  const hitSlop = { top: 12, bottom: 12, left: 12, right: 12 }
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={[gdprStyles.backdrop, { paddingBottom: Spacing.base + insets.bottom, paddingTop: insets.top }]}>
        <View style={gdprStyles.card}>
          <View style={gdprStyles.logoCircle}>
            <Ionicons name="boat" size={26} color={C.primary} />
          </View>
          <Text style={gdprStyles.appName}>Rentivo</Text>
          <Text style={gdprStyles.title}>{t('gdprTitle', language)}</Text>
          <Text style={gdprStyles.body}>{t('gdprBody', language)}</Text>
          <View style={gdprStyles.links}>
            {/* These four controls gate a legal consent. They were bare
                TouchableOpacity wrappers around 14px text: no role, no label,
                no hitSlop — unreachable with a screen reader and under 44px. */}
            <TouchableOpacity
              onPress={() => void Linking.openURL('https://rentivo.domrol.com/legal/privacy')}
              accessibilityRole="link"
              accessibilityLabel={t('gdprOpenPrivacyA11y', language)}
              hitSlop={hitSlop}
              style={gdprStyles.linkBtn}
            >
              <Text style={gdprStyles.link}>{t('privacyPolicy', language)}</Text>
            </TouchableOpacity>
            <Text style={gdprStyles.linkSep}> · </Text>
            <TouchableOpacity
              onPress={() => void Linking.openURL('https://rentivo.domrol.com/legal/terms')}
              accessibilityRole="link"
              accessibilityLabel={t('gdprOpenTermsA11y', language)}
              hitSlop={hitSlop}
              style={gdprStyles.linkBtn}
            >
              <Text style={gdprStyles.link}>{t('termsOfService', language)}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={gdprStyles.acceptBtn}
            onPress={onAccept}
            accessibilityRole="button"
            accessibilityLabel={t('gdprAccept', language)}
            hitSlop={hitSlop}
          >
            <Text style={gdprStyles.acceptBtnText}>{t('gdprAccept', language)}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={gdprStyles.manageBtn}
            onPress={onManage}
            accessibilityRole="button"
            accessibilityLabel={t('gdprManage', language)}
            hitSlop={hitSlop}
          >
            <Text style={gdprStyles.manageBtnText}>{t('gdprManage', language)}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

function makeGdprStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: C.overlay,
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: Spacing.base,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  logo: { fontFamily: Fonts.regular, fontSize: 40, marginBottom: Spacing.sm },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  appName: { fontSize: 20, fontFamily: Fonts.extrabold, color: C.text, marginBottom: Spacing.md },
  title: { fontSize: 18, fontFamily: Fonts.bold, color: C.text, marginBottom: Spacing.sm, textAlign: 'center' },
  body: { fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.md },
  links: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xl },
  // 44×44 minimum touch target for the two legal links.
  linkBtn: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  // Legal links are navigation, not the modal's primary action (Accept) →
  // muted ink (5.67:1 light, 8.61:1 dark).
  link: { fontSize: 13, color: C.textSecondary, fontFamily: Fonts.semibold },
  linkSep: { fontFamily: Fonts.regular, fontSize: 13, color: C.textTertiary },
  acceptBtn: {
    backgroundColor: C.primary,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    width: '100%',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  acceptBtnText: { fontSize: 16, fontFamily: Fonts.bold, color: C.textInverse },
  // Was ~33px tall — under the 44px minimum for a consent-gate control.
  manageBtn: {
    paddingVertical: Spacing.sm,
    minHeight: 44,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageBtnText: { fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary },
  })
}



function RootLayoutInner() {
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    Archivo_700Bold,
    Archivo_800ExtraBold,
  })
  const isDark = useThemeStore(s => s.isDark)

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync()
    }
  }, [fontsLoaded, fontError])
  const { setSession, setUser, setOperator, setHost, session, role, language } = useAuthStore()
  const { setPushToken, setUnreadCount, unreadCount } = useNotificationStore()
  const [gdprAccepted, setGdprAccepted] = useState<boolean | null>(null)
  const pathname = usePathname()

  // Check GDPR acceptance
  useEffect(() => {
    AsyncStorage.getItem('gdpr_accepted').then(val => {
      setGdprAccepted(val === 'true')
    }).catch(() => setGdprAccepted(true))
  }, [])

  // Helper: fetch rentivo_users profile and push it into the auth store.
  // Called both on initial session restore and on every auth state change.
  const syncProfileFromSession = useCallback(async (s: Record<string, unknown> | null) => {
    setSession(s)
    if (!s) {
      setUser(null)
      setOperator(null)
      setHost(null)
      return
    }
    const uid = (s as Record<string, unknown> & { user?: { id?: string } }).user?.id
    if (!uid) return
    const { data: profile } = await supabase
      .from('rentivo_users')
      .select('*')
      .eq('id', uid)
      .maybeSingle()
    if (profile) {
      setUser(profile as RentivoUser)
    }
    // Hydrate operator/host records so the dashboard is populated on any device
    // (keyed on auth_id = auth.uid(); RLS scopes each read to the caller's own row).
    const { data: op } = await supabase
      .from('rentivo_operators')
      .select('*')
      .eq('auth_id', uid)
      .maybeSingle()
    setOperator(op ? (op as unknown as Parameters<typeof setOperator>[0]) : null)
    const { data: hostRow } = await supabase
      .from('rentivo_hosts')
      .select('*')
      .eq('auth_id', uid)
      .maybeSingle()
    setHost(hostRow ? (hostRow as unknown as Parameters<typeof setHost>[0]) : null)
  }, [setSession, setUser, setOperator, setHost])

  // Supabase auth — restore session on startup and keep in sync
  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      void syncProfileFromSession(s as Record<string, unknown> | null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => { void syncProfileFromSession(s as Record<string, unknown> | null) },
    )
    return () => subscription.unsubscribe()
  }, [syncProfileFromSession])

  // GDPR DB consent gate — new users who bypassed the modal
  useEffect(() => {
    if (!session) return
    const userId = (session as Record<string, unknown> & { user?: { id?: string } }).user?.id
    if (!userId) return
    // Prevent infinite loop: skip on all auth/ and onboarding screens
    if (pathname.startsWith('/auth')) return
    if (pathname.startsWith('/onboarding')) return

    void supabase
      .from('rentivo_consent')
      .select('terms_accepted, privacy_accepted')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data?.terms_accepted || !data?.privacy_accepted) {
          router.replace('/auth/consent')
        }
      })
  }, [(session as Record<string, unknown> & { user?: { id?: string } })?.user?.id, pathname])

  // Push notifications
  useEffect(() => {
    if (!session) return
    registerForPushNotifications().then(token => {
      if (!token) return
      setPushToken(token)
      const userId = (session as Record<string, unknown> & { user?: { id?: string } }).user?.id
      if (userId) {
        void savePushToken(userId, token, role === 'operator')
      }
    }).catch(() => {})
  }, [session, role, setPushToken])

  // Notification listeners
  useEffect(() => {
    const sub1 = Notifications.addNotificationReceivedListener(() => {
      setUnreadCount(unreadCount + 1)
    })
    const sub2 = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, string>
      if (data.bookingId) {
        // Navigation would happen here via router
        void data
      }
    })
    return () => {
      sub1.remove()
      sub2.remove()
    }
  }, [unreadCount, setUnreadCount])

  const handleGdprAccept = useCallback(async () => {
    await AsyncStorage.setItem('gdpr_accepted', 'true')
    setGdprAccepted(true)
  }, [])

  const handleGdprManage = useCallback(async () => {
    await AsyncStorage.setItem('gdpr_accepted', 'true')
    setGdprAccepted(true)
    setTimeout(() => {
      router.push('/(consumer)/profile/privacy-settings')
    }, 300)
  }, [])

  if (!fontsLoaded && !fontError) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY || ''}>
          <Fragment>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <OfflineBanner />
            <Stack
              initialRouteName="index"
              screenOptions={{ headerShown: false }}
            />
            {gdprAccepted === false ? (
              <GdprModal
                visible
                onAccept={handleGdprAccept}
                onManage={handleGdprManage}
                language={language}
              />
            ) : null}
            <Toast />
          </Fragment>
        </StripeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <RootLayoutInner />
    </ErrorBoundary>
  )
}
