import { generateContractHTML, generateAndSavePDF } from '@/lib/contract'
import type { Booking } from '@/types'

export async function buildContractPDF(
  booking: Booking,
  consumerSig?: string,
  operatorSig?: string,
): Promise<string> {
  const html = generateContractHTML(booking, consumerSig, operatorSig)
  return generateAndSavePDF(html)
}
