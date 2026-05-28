import * as Sentry from '@sentry/react-native'

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? ''

let initialized = false

export function initSentry() {
  if (initialized) return
  if (!DSN) {
    // No DSN configured (e.g. local dev) — skip init so the app boots normally.
    return
  }
  Sentry.init({
    dsn: DSN,
    // Error monitoring only — replay & user feedback intentionally disabled
    // (SDK 54 iOS build incompatibility with the user-feedback integration).
    enableAutoSessionTracking: true,
    tracesSampleRate: 0.2,
  })
  initialized = true
}

export function captureException(error: unknown, extra?: Record<string, unknown>) {
  if (!initialized) {
    if (__DEV__) console.warn('[Sentry] not initialized — captured locally:', error)
    return
  }
  Sentry.captureException(error, extra ? { extra } : undefined)
}
