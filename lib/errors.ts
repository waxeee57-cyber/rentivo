export const ERROR_MESSAGES: Record<string, string> = {
  // Network
  network_error: 'No internet connection. Check your WiFi and try again.',
  timeout: 'This is taking too long. Check your connection and try again.',
  server_error: 'Something went wrong on our end. Try again in a moment.',

  // Auth
  invalid_otp: 'Wrong code. Check your messages and try again.',
  otp_expired: 'This code has expired. Request a new one.',
  phone_invalid: 'Please enter a valid phone number.',
  email_invalid: 'Please enter a valid email address.',

  // Booking
  dates_unavailable: 'These dates are no longer available. Please choose different dates.',
  min_days: 'This vehicle requires a minimum rental of {n} days.',
  payment_failed: 'Payment failed. Check your card details and try again.',
  booking_failed: 'Could not complete booking. Please try again.',

  // Forms
  name_required: 'Please enter your name.',
  name_too_short: 'Your name must be at least 2 characters.',
  phone_required: 'Please enter your phone number.',
  required_field: 'This field is required.',

  // Photos
  photo_permission: 'Camera access is needed to take photos. Allow it in Settings.',
  photo_failed: 'Could not load photo. Try again.',
  min_photos: 'Please add at least {n} photos.',

  // Signature
  signature_required: 'Please sign before continuing.',
  both_signatures: 'Both parties need to sign.',
}

export function getError(key: string, vars?: Record<string, string>): string {
  let msg = ERROR_MESSAGES[key] ?? 'Something went wrong. Please try again.'
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      msg = msg.replace(`{${k}}`, v)
    })
  }
  return msg
}
