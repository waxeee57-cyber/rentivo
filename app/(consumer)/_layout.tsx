import { Tabs } from 'expo-router'
import { Colors } from '@/constants/colors'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { t } from '@/constants/i18n'
import { Ionicons } from '@expo/vector-icons'

export default function ConsumerLayout() {
  const { language } = useAuthStore()
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          height: 60,
          paddingBottom: 8,
        },
      }}
    >
      <Tabs.Screen
        name="explore/index"
        options={{
          title: t('explore', language),
          tabBarIcon: ({ color }) => <Ionicons name="map-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search/index"
        options={{
          title: t('search', language),
          tabBarIcon: ({ color }) => <Ionicons name="search-outline" size={24} color={color} />,
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
        name="profile/index"
        options={{
          title: t('profile', language),
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen name="listing/[id]" options={{ href: null }} />
      <Tabs.Screen name="booking/[listingId]" options={{ href: null }} />
      <Tabs.Screen name="booking/confirmation/[id]" options={{ href: null }} />
      <Tabs.Screen name="bookings/[id]" options={{ href: null }} />
      <Tabs.Screen name="damage/pickup/[bookingId]" options={{ href: null }} />
      <Tabs.Screen name="damage/return/[bookingId]" options={{ href: null }} />
    </Tabs>
  )
}
