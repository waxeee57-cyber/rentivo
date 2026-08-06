import { Platform } from 'react-native'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'

/**
 * GDPR Article 20 — data portability.
 *
 * "Export my data" used to raise an Alert saying the data would arrive by email
 * within 30 days, and then did nothing at all: no job was queued, no mail was
 * sent, no file was produced. A right that is announced and not implemented is
 * worse than one that is absent, because the user stops asking.
 *
 * This module gathers every row the account owns, from every table it can read
 * under its own RLS policies, and writes a single JSON file the user keeps.
 */

/** One (table, user-identifying column) pair that belongs to the subject. */
export interface GdprExportSource {
  table: string
  column: string
}

/**
 * Every table carrying rows owned by the subject, with the column that ties the
 * row to them. Kept declarative on purpose: scripts/e2e/gdpr.mjs reads this list
 * out of this file and replays it against the deployed API, so an omission here
 * fails the end-to-end proof instead of silently shrinking the export.
 *
 * Only tables whose RLS grants the subject a self-read are listed — anything
 * else would contribute a silent empty array and misrepresent the export as
 * complete.
 */
export const GDPR_EXPORT_SOURCES: readonly GdprExportSource[] = [
  { table: 'rentivo_users', column: 'id' },
  { table: 'rentivo_operators', column: 'auth_id' },
  { table: 'rentivo_hosts', column: 'auth_id' },
  { table: 'rentivo_bookings', column: 'user_id' },
  { table: 'rentivo_reviews', column: 'user_id' },
  { table: 'rentivo_wishlist', column: 'user_id' },
  { table: 'rentivo_consent', column: 'user_id' },
  { table: 'rentivo_notifications', column: 'user_id' },
  { table: 'rentivo_loyalty', column: 'user_id' },
  { table: 'rentivo_identity_verifications', column: 'user_id' },
  { table: 'rentivo_conversations', column: 'user_id' },
  { table: 'rentivo_messages', column: 'sender_id' },
  { table: 'rentivo_disputes', column: 'raised_by_auth_id' },
  { table: 'rentivo_reports', column: 'reporter_id' },
  { table: 'rentivo_referrals', column: 'referrer_user_id' },
  { table: 'rentivo_referrals', column: 'referred_user_id' },
]

export type GdprExportRow = Record<string, unknown>

export interface GdprExportPayload {
  export_format: 'rentivo.gdpr.v1'
  generated_at: string
  subject: { auth_user_id: string; email: string | null }
  /** Keyed `table.column`, because one table can hold the subject twice. */
  data: Record<string, GdprExportRow[]>
  /** Sources that could not be read, with the reason. Never silently dropped. */
  unavailable: { source: string; error: string }[]
}

/**
 * Read every row the subject owns.
 *
 * A source that fails is recorded in `unavailable` rather than dropped: an
 * export that quietly omits a table looks identical to an export of a user who
 * has no rows in it, and the subject has no way to tell the difference.
 */
export async function collectGdprExport(
  userId: string,
  email: string | null,
): Promise<GdprExportPayload> {
  const data: Record<string, GdprExportRow[]> = {}
  const unavailable: { source: string; error: string }[] = []

  for (const source of GDPR_EXPORT_SOURCES) {
    const key = `${source.table}.${source.column}`
    const { data: rows, error } = await supabase
      .from(source.table)
      .select('*')
      .eq(source.column, userId)
    if (error) {
      unavailable.push({ source: key, error: error.message })
      continue
    }
    data[key] = (rows ?? []) as GdprExportRow[]
  }

  return {
    export_format: 'rentivo.gdpr.v1',
    generated_at: new Date().toISOString(),
    subject: { auth_user_id: userId, email },
    data,
    unavailable,
  }
}

/** Stable, human-readable, collision-free enough for a downloads folder. */
export function gdprExportFileName(userId: string, at: Date = new Date()): string {
  return `rentivo-data-export-${userId.slice(0, 8)}-${at.toISOString().slice(0, 10)}.json`
}

export interface GdprExportResult {
  ok: boolean
  /** Local file URI on native, or the object URL that was downloaded on web. */
  uri?: string
  fileName?: string
  /** Row count per `table.column`, for the caller to surface or log. */
  counts?: Record<string, number>
  unavailable?: { source: string; error: string }[]
  /** True when Config.useMock short-circuited the real read. */
  mocked?: boolean
  error?: string
}

/**
 * Browser download path. react-native-web is a shipping target, and neither the
 * native file API nor the share sheet exists there, so the file is handed over
 * as an ordinary download. Typed through a narrow shim rather than pulling the
 * whole DOM lib into a React Native tsconfig.
 */
function downloadOnWeb(fileName: string, json: string): string | null {
  const g = globalThis as unknown as {
    Blob?: new (parts: string[], options: { type: string }) => object
    URL?: { createObjectURL(blob: object): string; revokeObjectURL(url: string): void }
    document?: {
      createElement(tag: string): { href: string; download: string; click(): void }
    }
  }
  if (!g.Blob || !g.URL || !g.document) return null
  const url = g.URL.createObjectURL(new g.Blob([json], { type: 'application/json' }))
  const anchor = g.document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  g.URL.revokeObjectURL(url)
  return url
}

/**
 * Produce the subject's data as a file they keep, and offer it to the OS share
 * sheet so it can leave the device — which is the portability the Article is
 * about. Returns a result object; the caller decides what to show.
 */
export async function exportMyData(): Promise<GdprExportResult> {
  // Mock mode must not read production. Every other API module in this repo
  // short-circuits here; an export that ignored the flag would pull a real
  // person's rows onto a demo device and write them to its filesystem.
  if (Config.useMock) {
    return { ok: true, fileName: gdprExportFileName('mock'), counts: {}, mocked: true }
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) return { ok: false, error: sessionError.message }
  const user = sessionData.session?.user
  if (!user) return { ok: false, error: 'no-session' }

  const payload = await collectGdprExport(user.id, user.email ?? null)
  const json = JSON.stringify(payload, null, 2)
  const fileName = gdprExportFileName(user.id)
  const counts = Object.fromEntries(
    Object.entries(payload.data).map(([key, rows]) => [key, rows.length]),
  )

  if (Platform.OS === 'web') {
    const url = downloadOnWeb(fileName, json)
    if (!url) {
      return { ok: false, error: 'download-unsupported', counts, unavailable: payload.unavailable }
    }
    return { ok: true, uri: url, fileName, counts, unavailable: payload.unavailable }
  }

  try {
    const file = new File(Paths.cache, fileName)
    if (file.exists) file.delete()
    file.create()
    file.write(json)
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        UTI: 'public.json',
        dialogTitle: fileName,
      })
    }
    return { ok: true, uri: file.uri, fileName, counts, unavailable: payload.unavailable }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'write-failed',
      counts,
      unavailable: payload.unavailable,
    }
  }
}
