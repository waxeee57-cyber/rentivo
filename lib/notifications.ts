import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { supabase } from '@/lib/supabase'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== 'granted') return null

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      })
    }

    const tokenData = await Notifications.getExpoPushTokenAsync()
    return tokenData.data
  } catch {
    return null
  }
}

export async function savePushToken(
  userId: string,
  token: string,
  isOperator = false,
): Promise<void> {
  if (isOperator) {
    await supabase
      .from('rentivo_operators')
      .update({ push_token: token } as never)
      .eq('auth_id', userId)
  } else {
    await supabase
      .from('rentivo_users')
      .update({ push_token: token } as never)
      .eq('auth_id', userId)
  }
}

export type NotificationType =
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'new_message'
  | 'pickup_reminder'
  | 'return_reminder'
  | 'review_request'
  | 'new_booking'
  | 'rental_completed'

export function getNotificationContent(
  type: NotificationType,
  data: Record<string, string>,
): { title: string; body: string } {
  const map: Record<NotificationType, { title: string; body: string }> = {
    booking_confirmed: {
      title: '✅ Booking Confirmed',
      body: `Your ${data.vehicle ?? 'rental'} is confirmed for ${data.dates ?? ''}`,
    },
    booking_cancelled: {
      title: '❌ Booking Cancelled',
      body: `Your booking for ${data.vehicle ?? 'rental'} has been cancelled`,
    },
    new_message: {
      title: `💬 ${data.sender ?? 'New message'}`,
      body: data.message ?? '',
    },
    pickup_reminder: {
      title: '🚗 Pickup Tomorrow',
      body: `Your ${data.vehicle ?? 'rental'} starts tomorrow at ${data.time ?? ''}`,
    },
    return_reminder: {
      title: '⏰ Return Today',
      body: `Please return your ${data.vehicle ?? 'rental'} by ${data.time ?? ''}`,
    },
    review_request: {
      title: '⭐ How was your rental?',
      body: `Leave a review for your ${data.vehicle ?? 'rental'}`,
    },
    new_booking: {
      title: '🎉 New Booking',
      body: `${data.guestName ?? 'Guest'} booked ${data.vehicle ?? ''} for ${data.dates ?? ''}`,
    },
    rental_completed: {
      title: '✅ Rental Completed',
      body: `${data.guestName ?? 'Guest'} has returned the ${data.vehicle ?? 'vehicle'}`,
    },
  }
  return map[type]
}
