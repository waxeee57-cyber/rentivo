import { Linking } from 'react-native'
import { trackEvent } from '@/lib/analytics'

export async function openAffiliateLink(
  url: string,
  platform: string,
  listingId: string,
): Promise<void> {
  trackEvent('affiliate_click', {
    platform,
    listing_id: listingId,
    url: url.split('?')[0],
  })

  const canOpen = await Linking.canOpenURL(url)
  if (canOpen) {
    await Linking.openURL(url)
  }
}

export function addAffiliateParams(url: string, platform: string): string {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}utm_source=rentivo&utm_medium=affiliate&utm_campaign=${platform}`
}
