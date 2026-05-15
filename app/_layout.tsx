import { useEffect, useState, Fragment } from 'react'
import { Stack, router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import {
  GestureHandlerRootView,
} from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
} from 'react-native'
import { StripeProvider } from '@stripe/stripe-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Notifications from 'expo-notifications'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useNotificationStore } from '@/lib/store/useNotificationStore'
import { supabase } from '@/lib/supabase'
import { STRIPE_PUBLISHABLE_KEY } from '@/lib/stripe'
import { registerForPushNotifications, savePushToken } from '@/lib/notifications'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { t } from '@/constants/i18n'
import { Toast } from '@/components/ui/Toast'
import { OfflineBanner } from '@/components/ui/OfflineBanner'

function GdprModal({ visible, onAccept, onManage, language }: {
  visible: boolean
  onAccept: () => void
  onManage: () => void
  language: 'en' | 'es' | 'hu'
}) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={gdprStyles.backdrop}>
        <View style={gdprStyles.card}>
          <Text style={gdprStyles.logo}>🌴</Text>
          <Text style={gdprStyles.appName}>Rentivo</Text>
          <Text style={gdprStyles.title}>{t('gdprTitle', language)}</Text>
          <Text style={gdprStyles.body}>{t('gdprBody', language)}</Text>
          <View style={gdprStyles.links}>
            <TouchableOpacity onPress={() => {}}>
              <Text style={gdprStyles.link}>{t('privacyPolicy', language)}</Text>
            </TouchableOpacity>
            <Text style={gdprStyles.linkSep}> · </Text>
            <TouchableOpacity onPress={() => {}}>
              <Text style={gdprStyles.link}>{t('termsOfService', language)}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={gdprStyles.acceptBtn} onPress={onAccept}>
            <Text style={gdprStyles.acceptBtnText}>{t('gdprAccept', language)}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={gdprStyles.manageBtn} onPress={onManage}>
            <Text style={gdprStyles.manageBtnText}>{t('gdprManage', language)}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const gdprStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: Spacing.base,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  logo: { fontSize: 40, marginBottom: Spacing.sm },
  appName: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: Spacing.md },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm, textAlign: 'center' },
  body: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.md },
  links: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xl },
  link: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  linkSep: { fontSize: 13, color: Colors.textTertiary },
  acceptBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  acceptBtnText: { fontSize: 16, fontWeight: '700', color: Colors.textInverse },
  manageBtn: { paddingVertical: Spacing.sm },
  manageBtnText: { fontSize: 14, color: Colors.textSecondary },
})

export default function RootLayout() {
  const { setSession, session, role, language } = useAuthStore()
  const { setPushToken, setUnreadCount, unreadCount } = useNotificationStore()
  const [gdprAccepted, setGdprAccepted] = useState<boolean | null>(null)

  // Check GDPR acceptance
  useEffect(() => {
    AsyncStorage.getItem('gdpr_accepted').then(val => {
      setGdprAccepted(val === 'true')
    }).catch(() => setGdprAccepted(true))
  }, [])

  // Supabase auth
  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s as Record<string, unknown> | null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => setSession(s as Record<string, unknown> | null),
    )
    return () => subscription.unsubscribe()
  }, [setSession])

  // GDPR DB consent gate — new users who bypassed the modal
  useEffect(() => {
    if (!session) return
    const userId = (session as Record<string, unknown> & { user?: { id?: string } }).user?.id
    if (!userId) return

    void supabase
      .from('rentivo_consent')
      .select('terms_accepted, privacy_accepted')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data?.terms_accepted || !data?.privacy_accepted) {
          router.replace('/auth/consent')
        }
      })
  }, [(session as Record<string, unknown> & { user?: { id?: string } })?.user?.id])

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

  const handleGdprAccept = async () => {
    await AsyncStorage.setItem('gdpr_accepted', 'true')
    setGdprAccepted(true)
  }

  const handleGdprManage = async () => {
    await AsyncStorage.setItem('gdpr_accepted', 'true')
    setGdprAccepted(true)
    // In a real app, navigate to cookie preferences
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder'}>
          <Fragment>
            <StatusBar style="light" />
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
