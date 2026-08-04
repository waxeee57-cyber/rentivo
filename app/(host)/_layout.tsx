import { Tabs } from 'expo-router'
import { View, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useColors } from '@/lib/hooks/useColors'
import { useAuthStore } from '@/lib/store/useAuthStore'
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

export default function HostLayout() {
  const C = useColors()
  const { language } = useAuthStore()

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
          // 10px: HU labels truncate at 11px
          fontFamily: 'Manrope_600SemiBold',
          fontSize: 10,
        },
      }}
    >
      <Tabs.Screen
        name="listings/index"
        options={{
          title: t('listings', language),
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'list' : 'list-outline'} focused={focused} />
          ),
        }}
        listeners={{ tabPress: triggerHaptic }}
      />
      <Tabs.Screen
        name="bookings/index"
        options={{
          title: t('bookings', language),
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'calendar' : 'calendar-outline'} focused={focused} />
          ),
        }}
        listeners={{ tabPress: triggerHaptic }}
      />
      <Tabs.Screen
        name="messages/index"
        options={{
          title: t('messages', language),
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
      <Tabs.Screen name="dashboard/index" options={DEEP_SCREEN} />
      <Tabs.Screen name="listings/new" options={DEEP_SCREEN} />
      <Tabs.Screen name="listings/add-external" options={DEEP_SCREEN} />
      <Tabs.Screen name="bookings/[id]" options={DEEP_SCREEN} />
    </Tabs>
  )
}
