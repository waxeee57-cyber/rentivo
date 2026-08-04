import { Tabs } from 'expo-router'
import { Fonts } from '@/constants/colors'
import { View, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useColors } from '@/lib/hooks/useColors'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useNotificationStore } from '@/lib/store/useNotificationStore'
import { useOperatorBookings } from '@/lib/hooks/useOperatorBookings'
import { Config } from '@/constants/config'
import { MOCK_OPERATOR } from '@/lib/mockData'
import { t } from '@/constants/i18n'

function TabIcon({ name, focused, size = 24 }: {
  name: React.ComponentProps<typeof Ionicons>['name']
  focused: boolean
  size?: number
}) {
  const C = useColors()
  return (
    <View style={tabIconStyles.container}>
      <Ionicons name={name} size={size} color={focused ? C.primary : C.textTertiary} />
      {focused && <View style={[tabIconStyles.dot, { backgroundColor: C.primary }]} />}
    </View>
  )
}

const tabIconStyles = StyleSheet.create({
  container: { alignItems: 'center', gap: 3 },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
})

const triggerHaptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

// Deep screens (detail, checkout, chat, legal, settings) are focused tasks, not
// destinations. `href: null` only hides them FROM the dock — the dock still
// rendered on top of them, stacking two competing bottom bars over the primary
// CTA. Every non-tab route now hides it.
const DEEP_SCREEN = {
  href: null,
  tabBarStyle: { display: 'none' as const },
} as const

export default function OperatorLayout() {
  const C = useColors()
  const { language, operator } = useAuthStore()
  const { operatorUnreadCount } = useNotificationStore()
  const opId = Config.useMock ? MOCK_OPERATOR.id : (operator?.id ?? null)
  const { bookings } = useOperatorBookings(opId)
  const pendingCount = bookings.filter(b => b.status === 'pending').length
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.textTertiary,
        // Floating dock — matches consumer layout
        tabBarStyle: {
          marginHorizontal: 14,
          marginBottom: 26,
          height: 64,
          borderRadius: 26,
          backgroundColor: C.surface,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: C.border,
          shadowColor: '#0A1628',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.16,
          shadowRadius: 28,
          elevation: 16,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          // 10px: HU labels (Irányítópult, Üzenetek) truncate at 11px
          fontFamily: 'Manrope_600SemiBold',
          fontSize: 10,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard/index"
        options={{
          title: t('dashboard', language),
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'grid' : 'grid-outline'} focused={focused} />
          ),
        }}
        listeners={{ tabPress: triggerHaptic }}
      />
      <Tabs.Screen
        name="bookings/index"
        options={{
          title: t('bookings', language),
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          tabBarBadgeStyle: { backgroundColor: C.error, fontFamily: Fonts.regular, fontSize: 10 },
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'calendar' : 'calendar-outline'} focused={focused} />
          ),
        }}
        listeners={{ tabPress: triggerHaptic }}
      />
      <Tabs.Screen
        name="fleet/index"
        options={{
          title: t('fleet', language),
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'car' : 'car-outline'} focused={focused} />
          ),
        }}
        listeners={{ tabPress: triggerHaptic }}
      />
      <Tabs.Screen
        name="messages/index"
        options={{
          title: t('messages', language),
          tabBarBadge: operatorUnreadCount > 0 ? operatorUnreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: C.error, fontFamily: Fonts.regular, fontSize: 10 },
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'chatbubbles' : 'chatbubbles-outline'} focused={focused} />
          ),
        }}
        listeners={{ tabPress: triggerHaptic }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: t('profile', language),
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'person-circle' : 'person-circle-outline'} focused={focused} />
          ),
        }}
        listeners={{ tabPress: triggerHaptic }}
      />
      {/* Hidden screens */}
      <Tabs.Screen name="analytics/index" options={DEEP_SCREEN} />
      <Tabs.Screen name="bookings/[id]" options={DEEP_SCREEN} />
      <Tabs.Screen name="bookings/chat/[bookingId]" options={DEEP_SCREEN} />
      <Tabs.Screen name="bookings/calendar" options={DEEP_SCREEN} />
      <Tabs.Screen name="fleet/new" options={DEEP_SCREEN} />
      <Tabs.Screen name="fleet/[id]" options={DEEP_SCREEN} />
      <Tabs.Screen name="fleet/ical-sync/[id]" options={DEEP_SCREEN} />
      <Tabs.Screen name="damage/[bookingId]" options={DEEP_SCREEN} />
      <Tabs.Screen name="profile/team" options={DEEP_SCREEN} />
      <Tabs.Screen name="settings/delivery" options={DEEP_SCREEN} />
      <Tabs.Screen name="settings/api/index" options={DEEP_SCREEN} />
      <Tabs.Screen name="fleet/pricing/[id]" options={DEEP_SCREEN} />
      <Tabs.Screen name="fleet/availability/[listingId]" options={DEEP_SCREEN} />
      <Tabs.Screen name="bookings/sign/[bookingId]" options={DEEP_SCREEN} />
      <Tabs.Screen name="bookings/dispute/[bookingId]" options={DEEP_SCREEN} />
    </Tabs>
  )
}
