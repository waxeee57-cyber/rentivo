import React from 'react'
import { LegalDocumentScreen } from '@/components/legal/LegalDocumentScreen'

// The text is NOT here — see constants/legal.ts.
//
// The three toggles this screen used to show (Essential / Analytics / Marketing
// "cookies") wrote to an AsyncStorage key `cookie_preferences` that NOTHING in
// the codebase ever read, so they controlled nothing: a consent UI that only
// pretends to record consent is worse than no UI. Real, server-persisted
// consent already lives in Profile → Privacy Settings, which upserts
// rentivo_consent and clears the push token on withdrawal; the document now
// points there. The copy is also corrected for a native app — this is device
// key-value storage and push/location identifiers, not browser cookies.
export default function CookiePolicyScreen() {
  return <LegalDocumentScreen docId="cookies" titleKey="cookiePolicy" />
}
