/**
 * Typed view over the single legal source of truth.
 *
 * The text itself lives in `constants/legal.data.mjs` — plain data, no types,
 * so that BOTH the app and `scripts/build-legal.mjs` (which has no TypeScript
 * toolchain) can consume the same literal. This module adds the types, the
 * operator-identity substitution and the platform-fee substitution, and is the
 * only thing the React Native screens import.
 *
 * See the header of legal.data.mjs for the editing rules.
 */
import { Config } from '@/constants/config'
import { LEGAL as LEGAL_DATA, LEGAL_ENTITY as LEGAL_ENTITY_DATA } from './legal.data.mjs'

export type LegalDocId = 'privacy' | 'terms' | 'cookies'
export type LegalLanguage = 'en' | 'es' | 'hu'

/** A section of a legal document. `body` is a list of paragraphs. */
export interface LegalSection {
  id: string
  title: string
  body: string[]
}

export interface LegalDoc {
  title: string
  updated: string
  version: string
  intro: string
  sections: LegalSection[]
}

export interface LegalEntity {
  legalName: string
  seatAddress: string
  regNumber: string
  taxNumber: string
}

/**
 * Operator identity — TODO placeholders until the real registered details are
 * supplied. Deliberately loud so a placeholder cannot ship unnoticed.
 */
export const LEGAL_ENTITY: LegalEntity = LEGAL_ENTITY_DATA

/**
 * Every legal document, in every language. The annotation is the contract: if
 * legal.data.mjs drifts out of shape, this assignment stops compiling.
 */
export const LEGAL: Record<LegalLanguage, Record<LegalDocId, LegalDoc>> = LEGAL_DATA

export const LEGAL_LANGUAGES: readonly LegalLanguage[] = ['en', 'es', 'hu']
export const LEGAL_DOC_IDS: readonly LegalDocId[] = ['privacy', 'terms', 'cookies']

/**
 * Prefix marking a body paragraph that should render as a list item. Tables in
 * the source documents are flattened into these.
 */
export const LEGAL_BULLET = '· '

export function isLegalBullet(paragraph: string): boolean {
  return paragraph.startsWith(LEGAL_BULLET)
}

export function stripLegalBullet(paragraph: string): string {
  return isLegalBullet(paragraph) ? paragraph.slice(LEGAL_BULLET.length) : paragraph
}

/**
 * The platform fee as a display percentage, derived from the same value the
 * checkout charges. Formatted exactly like components/booking/PriceBreakdown so
 * the contract and the price line can never quote different numbers.
 */
export function platformFeeLabel(): string {
  const pct = Config.platformCut * 100
  return `${pct.toFixed(Number.isInteger(pct) ? 0 : 1)}%`
}

/**
 * Substitute the `{{...}}` tokens. Unknown tokens are left alone rather than
 * blanked, so a typo is visible in review instead of silently deleting a clause.
 */
export function fillLegalTokens(text: string): string {
  return text
    .replace(/\{\{LEGAL_NAME\}\}/g, LEGAL_ENTITY.legalName)
    .replace(/\{\{SEAT_ADDRESS\}\}/g, LEGAL_ENTITY.seatAddress)
    .replace(/\{\{REG_NUMBER\}\}/g, LEGAL_ENTITY.regNumber)
    .replace(/\{\{TAX_NUMBER\}\}/g, LEGAL_ENTITY.taxNumber)
    .replace(/\{\{PLATFORM_FEE\}\}/g, platformFeeLabel())
}

/** The document to render, with every token already substituted. */
export function getLegalDoc(language: LegalLanguage, docId: LegalDocId): LegalDoc {
  const doc = LEGAL[language]?.[docId] ?? LEGAL.en[docId]
  return {
    title: fillLegalTokens(doc.title),
    updated: doc.updated,
    version: doc.version,
    intro: fillLegalTokens(doc.intro),
    sections: doc.sections.map(s => ({
      id: s.id,
      title: fillLegalTokens(s.title),
      body: s.body.map(fillLegalTokens),
    })),
  }
}
