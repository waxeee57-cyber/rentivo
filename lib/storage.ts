import { supabase } from '@/lib/supabase'
import * as FileSystem from 'expo-file-system/legacy'

function decode(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const bytes: number[] = []
  for (let i = 0; i < base64.length; i += 4) {
    const a = chars.indexOf(base64[i])
    const b = chars.indexOf(base64[i + 1])
    const c = chars.indexOf(base64[i + 2])
    const d = chars.indexOf(base64[i + 3])
    bytes.push((a << 2) | (b >> 4))
    if (base64[i + 2] !== '=') bytes.push(((b & 15) << 4) | (c >> 2))
    if (base64[i + 3] !== '=') bytes.push(((c & 3) << 6) | d)
  }
  return new Uint8Array(bytes)
}

export async function uploadDamagePhoto(
  bookingId: string,
  type: 'pickup' | 'return',
  slot: string,
  localUri: string,
): Promise<string | null> {
  try {
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    })
    const path = `damage/${bookingId}/${type}/${slot}.jpg`
    const { error } = await supabase.storage
      .from('rentivo-damage')
      .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: true })
    if (error) return null
    const { data } = supabase.storage.from('rentivo-damage').getPublicUrl(path)
    return data.publicUrl
  } catch {
    return null
  }
}

export async function uploadContractPDF(
  bookingId: string,
  localUri: string,
): Promise<string | null> {
  try {
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    })
    const path = `contracts/${bookingId}.pdf`
    const { error } = await supabase.storage
      .from('rentivo-contracts')
      .upload(path, decode(base64), { contentType: 'application/pdf', upsert: true })
    if (error) return null
    const { data } = supabase.storage.from('rentivo-contracts').getPublicUrl(path)
    return data.publicUrl
  } catch {
    return null
  }
}
