import React, { useEffect, useRef } from 'react'
import { Tabs } from 'expo-router'
import { View, StyleSheet, Animated } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useColors } from '@/lib/hooks/useColors'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useNotificationStore } from '@/lib/store/useNotificationStore'
import { MOCK_CONVERSATIONS } from '@/lib/mockData'
import { Config } from '@/constants/config'
import { t } from '@/constants/i18n'

function TabIcon({ name, focused, size = 24 }: {
  name: React.ComponentProps<typeof Ionicons>['name']
  focused: boolean
  size?: number
}) {
  const C = useColors()
  const scale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (focused) {
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.28, damping: 5, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, damping: 8, useNativeDriver: true }),
      ]).start()
    }
  }, [focused])

  return (
    <Animated.View style={[tabIconStyles.container, { transform: [{ scale }] }]}>
      <Ionicons name={name} size={size} color={focused ? C.primary : C.textTertiary} />
      {focused && <View style={[tabIconStyles.dot, { backgroundColor: C.primary }]} />}
    </Animated.View>
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

export default function ConsumerLayout() {
  const C = useColors()
  const { language } = useAuthStore()
  const { unreadCount } = useNotificationStore()
  const consumerChatUnread = Config.useMock
    ? MOCK_CONVERSATIONS.reduce((sum, c) => sum + (c.unread_consumer ?? 0), 0)
    : 0
  const bookingsBadge = unreadCount + consumerChatUnread

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.textTertiary,
        tabBarStyle: {
          backgroundColor: C.background,
          borderTopWidth: 1,
          borderTopColor: C.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 20,
          height: 88,
          paddingBottom: 12,
        },
        tabBarLabelStyle: {
          fontSize: 11,
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
        name="bookings"
        options={{
          title: t('bookings', language),
          tabBarBadge: bookingsBadge > 0 ? bookingsBadge : undefined,
          tabBarBadgeStyle: { backgroundColor: C.error, fontSize: 10 },
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'calendar' : 'calendar-outline'} focused={focused} />
          ),
        }}
        listeners={{ tabPress: triggerHaptic }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: t('assistant', language),
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} focused={focused} />
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
      <Tabs.Screen name="wishlist" options={{ href: null }} />
      <Tabs.Screen name="listing/[id]" options={{ href: null }} />
      <Tabs.Screen name="listing/reviews/[id]" options={{ href: null }} />
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
      <Tabs.Screen name="profile/delete-account" options={{ href: null }} />
      <Tabs.Screen name="profile/privacy-settings" options={{ href: null }} />
      <Tabs.Screen name="profile/notifications" options={{ href: null }} />
      <Tabs.Screen name="booking/sign/[bookingId]" options={{ href: null }} />
      <Tabs.Screen name="profile/identity-verification" options={{ href: null }} />
      <Tabs.Screen name="bookings/dispute/[bookingId]" options={{ href: null }} />
    </Tabs>
  )
}
