import { Tabs } from 'expo-router'
import { View, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Colors } from '@/constants/colors'
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
  return (
    <View style={tabIconStyles.container}>
      <Ionicons name={name} size={size} color={focused ? Colors.primary : Colors.textTertiary} />
      {focused && <View style={tabIconStyles.dot} />}
    </View>
  )
}

const tabIconStyles = StyleSheet.create({
  container: { alignItems: 'center', gap: 3 },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
})

const triggerHaptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

export default function OperatorLayout() {
  const { language, operator } = useAuthStore()
  const { operatorUnreadCount } = useNotificationStore()
  const opId = Config.useMock ? MOCK_OPERATOR.id : (operator?.id ?? null)
  const { bookings } = useOperatorBookings(opId)
  const pendingCount = bookings.filter(b => b.status === 'pending').length
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 20,
          height: 84,
          paddingBottom: 20,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t('dashboard', language),
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'grid' : 'grid-outline'} focused={focused} />
          ),
        }}
        listeners={{ tabPress: triggerHaptic }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: t('bookings', language),
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          tabBarBadgeStyle: { backgroundColor: Colors.error, fontSize: 10 },
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'calendar' : 'calendar-outline'} focused={focused} />
          ),
        }}
        listeners={{ tabPress: triggerHaptic }}
      />
      <Tabs.Screen
        name="fleet"
        options={{
          title: t('fleet', language),
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'car' : 'car-outline'} focused={focused} />
          ),
        }}
        listeners={{ tabPress: triggerHaptic }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t('messages', language),
          tabBarBadge: operatorUnreadCount > 0 ? operatorUnreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: Colors.error, fontSize: 10 },
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'chatbubbles' : 'chatbubbles-outline'} focused={focused} />
          ),
        }}
        listeners={{ tabPress: triggerHaptic }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile', language),
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'person-circle' : 'person-circle-outline'} focused={focused} />
          ),
        }}
        listeners={{ tabPress: triggerHaptic }}
      />
      {/* Hidden screens */}
      <Tabs.Screen name="bookings/[id]" options={{ href: null }} />
      <Tabs.Screen name="bookings/chat/[bookingId]" options={{ href: null }} />
      <Tabs.Screen name="bookings/calendar" options={{ href: null }} />
      <Tabs.Screen name="fleet/new" options={{ href: null }} />
      <Tabs.Screen name="fleet/[id]" options={{ href: null }} />
      <Tabs.Screen name="damage/[bookingId]" options={{ href: null }} />
      <Tabs.Screen name="profile/team" options={{ href: null }} />
    </Tabs>
  )
}
