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

export default function HostLayout() {
  const C = useColors()
  const { language } = useAuthStore()

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
        name="listings"
        options={{
          title: t('listings', language),
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'list' : 'list-outline'} focused={focused} />
          ),
        }}
        listeners={{ tabPress: triggerHaptic }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: t('bookings', language),
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'calendar' : 'calendar-outline'} focused={focused} />
          ),
        }}
        listeners={{ tabPress: triggerHaptic }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t('messages', language),
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
      <Tabs.Screen name="dashboard" options={{ href: null }} />
      <Tabs.Screen name="listings/new" options={{ href: null }} />
      <Tabs.Screen name="listings/add-external" options={{ href: null }} />
      <Tabs.Screen name="bookings/[id]" options={{ href: null }} />
    </Tabs>
  )
}
