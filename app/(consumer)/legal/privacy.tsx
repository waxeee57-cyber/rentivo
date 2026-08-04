import React from 'react'
import { LegalDocumentScreen } from '@/components/legal/LegalDocumentScreen'

// The text is NOT here. It lives in constants/legal.ts (data in
// constants/legal.data.mjs), which also feeds public/legal/privacy/index.html
// via scripts/build-legal.mjs. The hardcoded English SECTIONS array this
// replaced named a Spanish company as data controller while the hosted policy
// named a Hungarian sole trader — the two copies had already contradicted each
// other on the single most important field in the document.
export default function PrivacyPolicyScreen() {
  return <LegalDocumentScreen docId="privacy" titleKey="privacyPolicy" />
}
