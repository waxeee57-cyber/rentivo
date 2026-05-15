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

// Typed notification content factory
export const NOTIFICATIONS = {
  // Consumer
  BOOKING_CONFIRMED: (listingTitle: string) => ({
    title: '🎉 Booking confirmed!',
    body: `Your ${listingTitle} rental is confirmed. See you soon!`,
  }),
  PICKUP_REMINDER: (time: string, listingTitle: string) => ({
    title: '🚗 Pickup reminder',
    body: `${listingTitle} pickup at ${time}. Don't forget your ID!`,
  }),
  RETURN_REMINDER: (listingTitle: string) => ({
    title: '⏰ Return reminder',
    body: `Time to return your ${listingTitle}. Have a safe trip!`,
  }),

  // Operator
  NEW_BOOKING: (guestName: string, listingTitle: string, amount: string) => ({
    title: '📅 New booking request!',
    body: `${guestName} wants to rent ${listingTitle} for ${amount}`,
  }),
  PICKUP_TODAY: (guestName: string, time: string) => ({
    title: '🔑 Pickup today',
    body: `${guestName} picks up at ${time}. Vehicle ready?`,
  }),
  PAYMENT_RECEIVED: (amount: string) => ({
    title: '💰 Payment received',
    body: `${amount} deposited to your account`,
  }),

  // Price/availability alerts
  PRICE_DROP: (listingTitle: string, newPrice: string) => ({
    title: '📉 Price drop alert!',
    body: `${listingTitle} is now ${newPrice}/day — check your wishlist`,
  }),
  AVAILABILITY: (listingTitle: string) => ({
    title: '📅 Now available!',
    body: `${listingTitle} is now available for your dates`,
  }),
}

export async function schedulePickupReminder(
  bookingId: string,
  pickupDate: string,
  listingTitle: string,
): Promise<void> {
  try {
    const pickupTime = new Date(pickupDate)
    const reminderTime = new Date(pickupTime.getTime() - 24 * 60 * 60 * 1000)

    if (reminderTime > new Date()) {
      await Notifications.scheduleNotificationAsync({
        identifier: `pickup-reminder-${bookingId}`,
        content: NOTIFICATIONS.PICKUP_REMINDER('10:00', listingTitle),
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderTime },
      })
    }
  } catch {
    // Notifications not available in all environments
  }
}

export async function scheduleReturnReminder(
  bookingId: string,
  returnDate: string,
  listingTitle: string,
): Promise<void> {
  try {
    const returnTime = new Date(returnDate)
    returnTime.setHours(9, 0, 0, 0)

    if (returnTime > new Date()) {
      await Notifications.scheduleNotificationAsync({
        identifier: `return-reminder-${bookingId}`,
        content: NOTIFICATIONS.RETURN_REMINDER(listingTitle),
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: returnTime },
      })
    }
  } catch {
    // Notifications not available in all environments
  }
}

export function sendChatNotification(
  to: 'operator' | 'consumer',
  senderName: string,
  preview: string,
  isMock: boolean,
): void {
  const body = preview.length > 80 ? preview.slice(0, 80) + '…' : preview
  if (isMock) return
}

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
