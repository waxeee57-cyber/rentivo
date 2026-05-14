export function trackEvent(
  event: string,
  properties?: Record<string, string | number | boolean | null>,
): void {
  if (__DEV__) {
    console.log('[Analytics]', event, properties)
  }
  // TODO: Replace with actual analytics provider (Mixpanel, Amplitude, etc.)
}
