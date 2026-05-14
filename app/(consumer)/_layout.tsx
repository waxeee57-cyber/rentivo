import { Tabs } from 'expo-router'
import { View, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Colors } from '@/constants/colors'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useNotificationStore } from '@/lib/store/useNotificationStore'
import { MOCK_CONVERSATIONS } from '@/lib/mockData'
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

export default function ConsumerLayout() {
  const { language } = useAuthStore()
  const { unreadCount } = useNotificationStore()
  const consumerChatUnread = MOCK_CONVERSATIONS.reduce((sum, c) => sum + (c.unread_consumer ?? 0), 0)
  const bookingsBadge = unreadCount + consumerChatUnread

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
        name="explore"
        options={{
          title: t('explore', language),
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'map' : 'map-outline'} focused={focused} />
          ),
        }}
        listeners={{ tabPress: triggerHaptic }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t('search', language),
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'search' : 'search-outline'} focused={focused} />
          ),
        }}
        listeners={{ tabPress: triggerHaptic }}
      />
      <Tabs.Screen
        name="wishlist"
        options={{
          title: t('wishlist', language),
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'heart' : 'heart-outline'}
              size={24}
              color={focused ? Colors.primary : Colors.textTertiary}
            />
          ),
        }}
        listeners={{ tabPress: triggerHaptic }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: t('bookings', language),
          tabBarBadge: bookingsBadge > 0 ? bookingsBadge : undefined,
          tabBarBadgeStyle: { backgroundColor: Colors.error, fontSize: 10 },
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'calendar' : 'calendar-outline'} focused={focused} />
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
      <Tabs.Screen name="listing/[id]" options={{ href: null }} />
      <Tabs.Screen name="booking/[listingId]" options={{ href: null }} />
      <Tabs.Screen name="booking/confirmation/[id]" options={{ href: null }} />
      <Tabs.Screen name="bookings/[id]" options={{ href: null }} />
      <Tabs.Screen name="bookings/chat/[bookingId]" options={{ href: null }} />
      <Tabs.Screen name="bookings/review/[bookingId]" options={{ href: null }} />
      <Tabs.Screen name="profile/verify" options={{ href: null }} />
      <Tabs.Screen name="legal/privacy" options={{ href: null }} />
      <Tabs.Screen name="legal/terms" options={{ href: null }} />
      <Tabs.Screen name="legal/cookies" options={{ href: null }} />
      <Tabs.Screen name="damage/pickup/[bookingId]" options={{ href: null }} />
      <Tabs.Screen name="damage/return/[bookingId]" options={{ href: null }} />
      <Tabs.Screen name="profile/connected-platforms" options={{ href: null }} />
    </Tabs>
  )
}
