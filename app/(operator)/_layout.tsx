import { Tabs } from 'expo-router'
import { Colors } from '@/constants/colors'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useNotificationStore } from '@/lib/store/useNotificationStore'
import { t } from '@/constants/i18n'
import { Ionicons } from '@expo/vector-icons'

export default function OperatorLayout() {
  const { language } = useAuthStore()
  const { operatorUnreadCount } = useNotificationStore()
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
      }}
    >
      <Tabs.Screen
        name="dashboard/index"
        options={{
          title: t('dashboard', language),
          tabBarIcon: ({ color }) => <Ionicons name="bar-chart-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="bookings/index"
        options={{
          title: t('bookings', language),
          tabBarIcon: ({ color }) => <Ionicons name="calendar-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="fleet/index"
        options={{
          title: t('fleet', language),
          tabBarIcon: ({ color }) => <Ionicons name="car-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages/index"
        options={{
          title: 'Messages',
          tabBarBadge: operatorUnreadCount > 0 ? operatorUnreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: Colors.error, fontSize: 10 },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'chatbubble' : 'chatbubble-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: t('profile', language),
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen name="bookings/[id]" options={{ href: null }} />
      <Tabs.Screen name="bookings/chat/[bookingId]" options={{ href: null }} />
      <Tabs.Screen name="fleet/new" options={{ href: null }} />
      <Tabs.Screen name="fleet/[id]" options={{ href: null }} />
      <Tabs.Screen name="damage/[bookingId]" options={{ href: null }} />
    </Tabs>
  )
}
