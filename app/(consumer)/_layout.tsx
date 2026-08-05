import React, { useEffect, useRef } from 'react'
import { Fonts } from '@/constants/colors'
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

// Deep screens (detail, checkout, chat, legal, settings) are focused tasks, not
// destinations. `href: null` only hides them FROM the dock — the dock still
// rendered on top of them, so listing detail stacked a sticky "Select dates"
// bar and the nav dock into two competing bottom bars, ~90px of dead chrome
// over the most important CTA in the app. Every non-tab route now hides it.
const DEEP_SCREEN = {
  href: null,
  tabBarStyle: { display: 'none' as const },
} as const

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
        // Floating dock — detached rounded bar, the 2026 signature nav
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
          // 10px: HU labels (Felfedezés, Foglalások, Asszisztens) truncate at 11px
          fontFamily: 'Manrope_600SemiBold',
          fontSize: 10,
        },
      }}
    >
      <Tabs.Screen
        name="explore/index"
        options={{
          title: t('explore', language),
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'map' : 'map-outline'} focused={focused} />
          ),
        }}
        listeners={{ tabPress: triggerHaptic }}
      />
      <Tabs.Screen
        name="search/index"
        options={{
          title: t('search', language),
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'search' : 'search-outline'} focused={focused} />
          ),
        }}
        listeners={{ tabPress: triggerHaptic }}
      />
      <Tabs.Screen
        name="bookings/index"
        options={{
          // Consumer-side naming: "Trips" everywhere (tab, screen title "My
          // Trips", CTA) — three different names for one thing read as sloppy.
          title: t('myTrips', language),
          tabBarBadge: bookingsBadge > 0 ? bookingsBadge : undefined,
          tabBarBadgeStyle: { backgroundColor: C.error, fontFamily: Fonts.regular, fontSize: 10 },
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'calendar' : 'calendar-outline'} focused={focused} />
          ),
        }}
        listeners={{ tabPress: triggerHaptic }}
      />
      <Tabs.Screen
        name="assistant/index"
        options={{
          title: t('assistant', language),
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} focused={focused} />
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
      {/* Discover. A deep screen rather than a sixth tab: the dock is already
          at five, the feed is top-of-funnel reached from Explore rather than a
          peer of Bookings or Profile, and adding a tab would move every
          existing Maestro selector. */}
      <Tabs.Screen name="feed/index" options={DEEP_SCREEN} />
      <Tabs.Screen name="wishlist/index" options={DEEP_SCREEN} />
      <Tabs.Screen name="listing/[id]" options={DEEP_SCREEN} />
      <Tabs.Screen name="listing/reviews/[id]" options={DEEP_SCREEN} />
      <Tabs.Screen name="booking/[listingId]" options={DEEP_SCREEN} />
      <Tabs.Screen name="booking/confirmation/[id]" options={DEEP_SCREEN} />
      <Tabs.Screen name="bookings/[id]" options={DEEP_SCREEN} />
      <Tabs.Screen name="bookings/chat/[bookingId]" options={DEEP_SCREEN} />
      <Tabs.Screen name="bookings/review/[bookingId]" options={DEEP_SCREEN} />
      <Tabs.Screen name="profile/verify" options={DEEP_SCREEN} />
      <Tabs.Screen name="legal/privacy" options={DEEP_SCREEN} />
      <Tabs.Screen name="legal/terms" options={DEEP_SCREEN} />
      <Tabs.Screen name="legal/cookies" options={DEEP_SCREEN} />
      <Tabs.Screen name="damage/pickup/[bookingId]" options={DEEP_SCREEN} />
      <Tabs.Screen name="damage/return/[bookingId]" options={DEEP_SCREEN} />
      <Tabs.Screen name="profile/connected-platforms" options={DEEP_SCREEN} />
      <Tabs.Screen name="profile/delete-account" options={DEEP_SCREEN} />
      <Tabs.Screen name="profile/privacy-settings" options={DEEP_SCREEN} />
      <Tabs.Screen name="profile/notifications" options={DEEP_SCREEN} />
      <Tabs.Screen name="booking/sign/[bookingId]" options={DEEP_SCREEN} />
      <Tabs.Screen name="profile/identity-verification" options={DEEP_SCREEN} />
      <Tabs.Screen name="bookings/dispute/[bookingId]" options={DEEP_SCREEN} />
    </Tabs>
  )
}
