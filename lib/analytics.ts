export function trackEvent(
  event: string,
  properties?: Record<string, string | number | boolean | null>,
): void {
  // PostHog / Mixpanel — future gate (see CLAUDE.md)
  void event; void properties
}
