import { supabase } from '@/lib/supabase'
import * as FileSystem from 'expo-file-system/legacy'
// Required lazily, inside a try, on purpose.
//
// expo-image-manipulator resolves its native module at import time, so a static
// import throws "Cannot find native module 'ExpoImageManipulator'" on any build
// made before the package was added — and because this module is imported by
// the damage and listing screens, that would take those screens down entirely
// on an older dev client. Resizing is an optimisation; failing to resize must
// never cost the user their photo.
type ManipulatorModule = typeof import('expo-image-manipulator')
let manipulator: ManipulatorModule | null | undefined

/**
 * Shrink a camera-roll image before it goes anywhere near the network.
 *
 * A modern phone photograph is 3-8 MB and 4000px wide. The listing bucket caps
 * at 10 MB per object, six of those over hotel wifi is a minute of waiting, and
 * nothing in the app ever displays an image wider than a phone screen. 1600px
 * on the long edge at JPEG 0.75 lands around 200-400 KB with no visible loss at
 * display size.
 *
 * JPEG, not WebP: SaveFormat.WEBP is Android-only in expo-image-manipulator, and
 * a format that silently fails on half the fleet is worse than a slightly larger
 * file. The bucket accepts jpeg/png/webp.
 *
 * Failure is non-fatal — the original is uploaded instead. A photo that is
 * merely large beats no photo at all.
 */
const MAX_EDGE = 1600

async function shrink(localUri: string): Promise<string> {
  if (manipulator === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      manipulator = require('expo-image-manipulator') as ManipulatorModule
    } catch {
      manipulator = null
    }
  }
  if (!manipulator) return localUri

  try {
    const ctx = manipulator.ImageManipulator.manipulate(localUri).resize({ width: MAX_EDGE })
    const image = await ctx.renderAsync()
    const out = await image.saveAsync({ compress: 0.75, format: manipulator.SaveFormat.JPEG })
    return out.uri
  } catch {
    return localUri
  }
}

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

/**
 * Put a listing photograph in object storage and return a URL that works on
 * somebody else's phone.
 *
 * This function did not exist. Every "add vehicle" screen took the local URI
 * that expo-image-picker hands back - `file:///data/user/0/.../ImagePicker/x.jpeg`
 * - and wrote it straight into `rentivo_listings.images` and
 * `cover_image_url`. That path is meaningful only inside the sandbox of the
 * app that picked it, on that one device, until the cache is cleared. Every
 * listing photo any operator has ever uploaded is a broken image for every
 * renter, and the operator could not tell because their own device still
 * resolved it.
 *
 * Already-remote URLs pass through untouched: the "import from another
 * platform" screen supplies real https photo URLs and must not be re-uploaded.
 */
export async function uploadListingPhoto(
  ownerId: string,
  localUri: string,
  index: number,
): Promise<string> {
  if (/^https?:\/\//i.test(localUri)) return localUri

  const sized = await shrink(localUri)
  const base64 = await FileSystem.readAsStringAsync(sized, {
    encoding: FileSystem.EncodingType.Base64,
  })
  // Date.now() in the name so replacing photo 3 of a listing does not serve the
  // previous image out of the CDN cache.
  const path = `listings/${ownerId}/${Date.now()}-${index}.jpg`
  const { error } = await supabase.storage
    .from('rentivo-listings')
    .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: true })
  if (error) throw new Error(`Photo upload failed: ${error.message}`)
  const { data } = supabase.storage.from('rentivo-listings').getPublicUrl(path)
  return data.publicUrl
}

/**
 * Upload a whole photo tray, preserving order and dropping empty slots.
 * Sequential on purpose: six parallel multi-megabyte uploads on a hotel wifi
 * is how you get a timeout on all six instead of a slow success.
 */
export async function uploadListingPhotos(
  ownerId: string,
  uris: (string | null | undefined)[],
): Promise<string[]> {
  const out: string[] = []
  let i = 0
  for (const uri of uris) {
    if (!uri) continue
    out.push(await uploadListingPhoto(ownerId, uri, i++))
  }
  return out
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
  const sized = await shrink(localUri)
  const base64 = await FileSystem.readAsStringAsync(sized, {
    encoding: FileSystem.EncodingType.Base64,
  })
  const path = `damage/${bookingId}/${type}/${slot}.jpg`
  const { error } = await supabase.storage
    .from('rentivo-damage')
    .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: true })
  if (error) throw new Error(`Damage photo upload failed (${type}/${slot}): ${error.message}`)

  // SIGNED, not public. `rentivo-damage` is a private bucket, so the
  // /object/public/ URL this used to return is a 400 for everyone including the
  // uploader: the photos landed in storage and every screen that displayed them
  // showed a broken image, which for a deposit dispute is the same as having no
  // evidence at all.
  //
  // The long expiry is deliberate. These URLs are stored in
  // rentivo_damage_reports and read months later when a dispute surfaces; a
  // one-hour link would be dead by then. An unguessable capability URL on a
  // private bucket is strictly better than the public bucket the old code
  // assumed, and the whole set can be revoked by rotating the storage secret.
  const TEN_YEARS = 60 * 60 * 24 * 365 * 10
  const { data, error: signError } = await supabase.storage
    .from('rentivo-damage')
    .createSignedUrl(path, TEN_YEARS)
  if (signError || !data?.signedUrl) {
    throw new Error(`Damage photo URL could not be signed (${type}/${slot}): ${signError?.message ?? 'unknown'}`)
  }
  return data.signedUrl
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

  // The path HAS to start with the uploader's uid. The storage policy on this
  // bucket is `(storage.foldername(name))[1] = auth.uid()::text`, and the old
  // path was `contracts/<bookingId>.pdf`, whose first folder is the literal
  // string "contracts" — so every contract upload was rejected by RLS and no
  // signed rental agreement has ever reached storage.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in — cannot store the contract')
  const path = `${user.id}/${bookingId}.pdf`

  const { error } = await supabase.storage
    .from('rentivo-contracts')
    .upload(path, decode(base64), { contentType: 'application/pdf', upsert: true })
  if (error) throw new Error(`Contract upload failed (${bookingId}): ${error.message}`)

  // Private bucket: getPublicUrl returned a 400 for everyone. A rental contract
  // is read back at pickup, at return, and in a dispute months later, so the
  // link has to keep working — see the note on damage photos above.
  const TEN_YEARS = 60 * 60 * 24 * 365 * 10
  const { data, error: signError } = await supabase.storage
    .from('rentivo-contracts')
    .createSignedUrl(path, TEN_YEARS)
  if (signError || !data?.signedUrl) {
    throw new Error(`Contract URL could not be signed (${bookingId}): ${signError?.message ?? 'unknown'}`)
  }
  return data.signedUrl
}
