import React from 'react'
import { LegalDocumentScreen } from '@/components/legal/LegalDocumentScreen'

// The text is NOT here — see constants/legal.ts. The platform fee is rendered
// from Config.platformCut via the {{PLATFORM_FEE}} token, so the contract can
// never quote a percentage different from the one checkout charges.
export default function TermsOfServiceScreen() {
  return <LegalDocumentScreen docId="terms" titleKey="termsOfService" />
}
