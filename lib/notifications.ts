import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'
import { captureException } from '@/lib/sentry'

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
  // Mock builds must not write a device push token onto a real production row.
  // supabase-js returns no error for a zero-row UPDATE, so without this the
  // write looked successful whether or not it hit anything.
  if (Config.useMock) return
  const payload: Record<string, string> = { push_token: token }
  // `.select()` is what makes the write observable: neither branch looked at the
  // result, and supabase-js returns no error for an UPDATE that matched zero rows —
  // so a stale auth_id or an RLS denial stored no token at all and push simply went
  // quiet for that device, with nothing anywhere to say why.
  const { data, error } = isOperator
    ? await supabase.from('rentivo_operators').update(payload).eq('auth_id', userId).select('auth_id')
    : await supabase.from('rentivo_users').update(payload).eq('auth_id', userId).select('auth_id')

  // Called as `void savePushToken(...)` from app/_layout.tsx, so this must REPORT and
  // never throw — an unhandled rejection during boot is worse than a missing token.
  // `extra` deliberately omits userId and the token itself.
  if (error) {
    captureException(error, { scope: 'savePushToken', isOperator })
  } else if (!data || data.length === 0) {
    captureException(new Error('savePushToken matched no row'), { scope: 'savePushToken', isOperator })
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
    title: 'Booking confirmed!',
    body: `Your ${listingTitle} rental is confirmed. See you soon!`,
  }),
  PICKUP_REMINDER: (time: string, listingTitle: string) => ({
    title: 'Pickup reminder',
    body: `${listingTitle} pickup at ${time}. Don't forget your ID!`,
  }),
  RETURN_REMINDER: (listingTitle: string) => ({
    title: 'Return reminder',
    body: `Time to return your ${listingTitle}. Have a safe trip!`,
  }),

  // Operator
  NEW_BOOKING: (guestName: string, listingTitle: string, amount: string) => ({
    title: 'New booking request!',
    body: `${guestName} wants to rent ${listingTitle} for ${amount}`,
  }),
  PICKUP_TODAY: (guestName: string, time: string) => ({
    title: 'Pickup today',
    body: `${guestName} picks up at ${time}. Vehicle ready?`,
  }),
  PAYMENT_RECEIVED: (amount: string) => ({
    title: 'Payment received',
    body: `${amount} deposited to your account`,
  }),

  // Price/availability alerts
  PRICE_DROP: (listingTitle: string, newPrice: string) => ({
    title: 'Price drop alert!',
    body: `${listingTitle} is now ${newPrice}/day — check your wishlist`,
  }),
  AVAILABILITY: (listingTitle: string) => ({
    title: 'Now available!',
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

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send'

/**
 * Find a recipient's Expo push token in the tables savePushToken actually writes.
 *
 * A recipient can be a traveler or an owner, and the two live in different
 * tables, so both are consulted. `maybeSingle` on each rather than a join: there
 * is no relationship between them, and an account can legitimately be both.
 */
async function lookupPushToken(
  authId: string,
): Promise<{ token: string | null; error: unknown }> {
  const { data: user, error: userError } = await supabase
    .from('rentivo_users')
    .select('push_token')
    .eq('auth_id', authId)
    .maybeSingle()
  if (userError) return { token: null, error: userError }
  if (user?.push_token) return { token: user.push_token as string, error: null }

  const { data: operator, error: operatorError } = await supabase
    .from('rentivo_operators')
    .select('push_token')
    .eq('auth_id', authId)
    .maybeSingle()
  if (operatorError) return { token: null, error: operatorError }
  return { token: (operator?.push_token as string | null) ?? null, error: null }
}

export async function sendChatNotification(params: {
  recipientUserId: string
  senderName: string
  message: string
  bookingId: string
}): Promise<void> {
  if (Config.useMock) return

  try {
    // `rentivo_push_tokens` DOES NOT EXIST. savePushToken (above) writes the
    // token to rentivo_users.push_token / rentivo_operators.push_token, so the
    // write path and the read path were different stores and every lookup came
    // back 42P01. Not one chat or booking push has ever been delivered — the
    // error handling below worked perfectly and reported a table-not-found to
    // Sentry every single time.
    const { token, error } = await lookupPushToken(params.recipientUserId)

    // A query error is NOT "this user has no push token". An RLS denial or a dropped
    // connection would otherwise be indistinguishable from a genuine opt-out, and
    // notifications would go quiet for everyone with nothing to show for it. Report
    // it, then bail — delivery is best-effort and must never fail the send that
    // triggered it.
    if (error) {
      captureException(error, { scope: 'sendChatNotification.tokenLookup', bookingId: params.bookingId })
      return
    }
    if (!token) return
    const tokenData = { token }

    await fetch(EXPO_PUSH_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        to: tokenData.token,
        title: params.senderName,
        body: params.message.length > 100
          ? params.message.substring(0, 97) + '...'
          : params.message,
        data: {
          type: 'chat',
          bookingId: params.bookingId,
        },
        sound: 'default',
        badge: 1,
      }),
    })
  } catch (error) {
    // Deliberately NOT console.*: everything in scope here is either the guest's
    // chat text or a device push token, and a console call ships to the release
    // build's device log (adb logcat / Console.app), readable by any other app's
    // developer on the same handset. Sentry is the controlled destination. `extra`
    // carries the booking id only — enough to trace, no message body, no token.
    captureException(error, { scope: 'sendChatNotification', bookingId: params.bookingId })
  }
}

export async function sendBookingNotification(params: {
  recipientUserId: string
  title: string
  body: string
  bookingId: string
  type: 'booking_confirmed' | 'booking_cancelled' | 'pickup_reminder' | 'return_reminder'
}): Promise<void> {
  if (Config.useMock) return

  try {
    // See sendChatNotification: rentivo_push_tokens never existed.
    const { token, error } = await lookupPushToken(params.recipientUserId)

    // Same reasoning as sendChatNotification: an infrastructure failure must not be
    // read as "opted out of push".
    if (error) {
      captureException(error, { scope: 'sendBookingNotification.tokenLookup', bookingId: params.bookingId, type: params.type })
      return
    }
    if (!token) return
    const tokenData = { token }

    await fetch(EXPO_PUSH_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        to: tokenData.token,
        title: params.title,
        body: params.body,
        data: {
          type: params.type,
          bookingId: params.bookingId,
        },
        sound: 'default',
      }),
    })
  } catch (error) {
    // No console.*: `params.title` / `params.body` are rendered booking copy (guest
    // name, vehicle, dates) and `tokenData.token` is a device token — none of it
    // belongs in a shipped build's device log. `extra` stays to non-identifying ids.
    captureException(error, { scope: 'sendBookingNotification', bookingId: params.bookingId, type: params.type })
  }
}

export function getNotificationContent(
  type: NotificationType,
  data: Record<string, string>,
): { title: string; body: string } {
  const map: Record<NotificationType, { title: string; body: string }> = {
    booking_confirmed: {
      title: 'Booking Confirmed',
      body: `Your ${data.vehicle ?? 'rental'} is confirmed for ${data.dates ?? ''}`,
    },
    booking_cancelled: {
      title: 'Booking Cancelled',
      body: `Your booking for ${data.vehicle ?? 'rental'} has been cancelled`,
    },
    new_message: {
      title: `${data.sender ?? 'New message'}`,
      body: data.message ?? '',
    },
    pickup_reminder: {
      title: 'Pickup Tomorrow',
      body: `Your ${data.vehicle ?? 'rental'} starts tomorrow at ${data.time ?? ''}`,
    },
    return_reminder: {
      title: 'Return Today',
      body: `Please return your ${data.vehicle ?? 'rental'} by ${data.time ?? ''}`,
    },
    review_request: {
      title: 'How was your rental?',
      body: `Leave a review for your ${data.vehicle ?? 'rental'}`,
    },
    new_booking: {
      title: 'New Booking',
      body: `${data.guestName ?? 'Guest'} booked ${data.vehicle ?? ''} for ${data.dates ?? ''}`,
    },
    rental_completed: {
      title: 'Rental Completed',
      body: `${data.guestName ?? 'Guest'} has returned the ${data.vehicle ?? 'vehicle'}`,
    },
  }
  return map[type]
}
