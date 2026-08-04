import { supabase } from '@/lib/supabase'
import * as FileSystem from 'expo-file-system/legacy'

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/**
 * Decode standard base64 into bytes.
 *
 * The previous version indexed the RAW string in 4-char steps. `indexOf` returns -1
 * for anything outside the alphabet, so a single whitespace or newline — which
 * line-wrapped base64 is full of — both fed -1 into the bit maths and knocked the
 * 4-char grouping out of phase, silently corrupting every byte after it. The upload
 * still "succeeded", producing an unreadable photo. Normalising the input first is
 * the fix; malformed input now throws instead of returning garbage.
 */
function decode(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '')
  if (clean.length % 4 === 1) throw new Error('Malformed base64 payload')

  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4))
  let out = 0
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64_ALPHABET.indexOf(clean[i])
    const b = B64_ALPHABET.indexOf(clean[i + 1])
    const c = B64_ALPHABET.indexOf(clean[i + 2])
    const d = B64_ALPHABET.indexOf(clean[i + 3])
    bytes[out++] = (a << 2) | (b >> 4)
    // -1 means the quartet was short (stripped '=' padding), not a real symbol.
    if (c !== -1) bytes[out++] = ((b & 15) << 4) | (c >> 2)
    if (d !== -1) bytes[out++] = ((c & 3) << 6) | d
  }
  return out === bytes.length ? bytes : bytes.subarray(0, out)
}

export async function uploadDamagePhoto(
  bookingId: string,
  type: 'pickup' | 'return',
  slot: string,
  localUri: string,
): Promise<string> {
  // THROWS on failure (it used to return null on both a storage error and any thrown
  // exception). Callers swallowed the null and filed the damage report anyway, so a
  // deposit dispute could hinge on photos that were never stored — with nobody warned.
  // Both damage screens already wrap this in try/catch, so throwing aborts the report.
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  })
  const path = `damage/${bookingId}/${type}/${slot}.jpg`
  const { error } = await supabase.storage
    .from('rentivo-damage')
    .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: true })
  if (error) throw new Error(`Damage photo upload failed (${type}/${slot}): ${error.message}`)
  const { data } = supabase.storage.from('rentivo-damage').getPublicUrl(path)
  return data.publicUrl
}

export async function uploadContractPDF(
  bookingId: string,
  localUri: string,
): Promise<string> {
  // THROWS on failure — same reasoning as uploadDamagePhoto: a signed contract that
  // silently never reached storage is worse than a visible error.
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  })
  const path = `contracts/${bookingId}.pdf`
  const { error } = await supabase.storage
    .from('rentivo-contracts')
    .upload(path, decode(base64), { contentType: 'application/pdf', upsert: true })
  if (error) throw new Error(`Contract upload failed (${bookingId}): ${error.message}`)
  const { data } = supabase.storage.from('rentivo-contracts').getPublicUrl(path)
  return data.publicUrl
}
