import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import type { Booking } from '@/types'

export function generateContractHTML(
  booking: Booking,
  consumerSignature?: string,
  operatorSignature?: string,
): string {
  const startDate = new Date(booking.start_date).toLocaleDateString('en-GB')
  const endDate = new Date(booking.end_date).toLocaleDateString('en-GB')
  const total = `€${(booking.total_amount / 100).toFixed(2)}`
  const deposit = `€${(booking.deposit_amount / 100).toFixed(2)}`

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 24px; color: #1A1A1A; }
    h1 { color: #E8A44A; font-size: 24px; margin-bottom: 4px; }
    .subtitle { color: #6B6B6B; font-size: 14px; margin-bottom: 32px; }
    .section { margin-bottom: 24px; }
    .section h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; color: #6B6B6B; border-bottom: 1px solid #E8E4DC; padding-bottom: 8px; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 8px 0; font-size: 14px; }
    td:first-child { color: #6B6B6B; width: 40%; }
    .price-row td { font-weight: bold; font-size: 16px; }
    .terms { font-size: 12px; color: #6B6B6B; line-height: 1.6; background: #F5F3EF; padding: 16px; border-radius: 8px; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 32px; }
    .sig-box { border: 1px solid #E8E4DC; border-radius: 8px; padding: 16px; min-height: 120px; }
    .sig-box h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #6B6B6B; margin-bottom: 8px; }
    .sig-box img { max-width: 100%; max-height: 80px; }
    .badge { display: inline-block; background: #EAF7F1; color: #2D9B6F; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Rentivo</h1>
  <div class="subtitle">Vehicle Rental Agreement - Booking #${booking.id.slice(0, 8).toUpperCase()}</div>

  <div class="section">
    <h2>Rental Details</h2>
    <table>
      <tr><td>Vehicle</td><td>${booking.listing?.title ?? 'N/A'}</td></tr>
      <tr><td>Operator</td><td>${booking.operator?.name ?? 'N/A'}</td></tr>
      <tr><td>Pickup date</td><td>${startDate}${booking.pickup_time ? ' at ' + booking.pickup_time : ''}</td></tr>
      <tr><td>Return date</td><td>${endDate}${booking.return_time ? ' at ' + booking.return_time : ''}</td></tr>
      <tr><td>Duration</td><td>${booking.total_days} days</td></tr>
      <tr><td>Pickup location</td><td>${booking.pickup_location ?? booking.operator?.address ?? 'TBC'}</td></tr>
    </table>
  </div>

  <div class="section">
    <h2>Renter</h2>
    <table>
      <tr><td>Name</td><td>${booking.guest_name}</td></tr>
      <tr><td>Phone</td><td>${booking.guest_phone ?? '-'}</td></tr>
      <tr><td>Email</td><td>${booking.guest_email ?? '-'}</td></tr>
      <tr><td>Nationality</td><td>${booking.guest_nationality ?? '-'}</td></tr>
      <tr><td>Driver's license</td><td>${booking.driver_license_no ?? '-'}</td></tr>
    </table>
  </div>

  <div class="section">
    <h2>Payment</h2>
    <table>
      <tr><td>Daily rate</td><td>€${(booking.price_per_day / 100).toFixed(2)}</td></tr>
      <tr><td>Subtotal</td><td>€${(booking.subtotal / 100).toFixed(2)}</td></tr>
      <tr><td>Service fee</td><td>€${(booking.platform_fee / 100).toFixed(2)}</td></tr>
      <tr class="price-row"><td>Total charged</td><td>${total}</td></tr>
      <tr><td>Security deposit</td><td>${deposit}</td></tr>
    </table>
  </div>

  <div class="section">
    <h2>Terms</h2>
    <div class="terms">
      The renter agrees to return the vehicle in the same condition as received.
      Any damage found during the return inspection will be documented and may
      result in charges against the security deposit. The renter must hold a
      valid driver's license for the duration of the rental. The vehicle must
      not be driven under the influence of alcohol or drugs.
      ${booking.listing?.rules ? '<br><br>Additional rules: ' + booking.listing.rules : ''}
    </div>
  </div>

  <div class="signatures">
    <div class="sig-box">
      <h3>Renter signature</h3>
      ${consumerSignature
        ? `<img src="${consumerSignature}" /><br><span class="badge">Signed</span>`
        : '<p style="color:#A0A0A0;font-size:12px">Pending signature</p>'}
      <p style="font-size:12px;color:#6B6B6B;margin-top:8px">${booking.guest_name}</p>
    </div>
    <div class="sig-box">
      <h3>Operator signature</h3>
      ${operatorSignature
        ? `<img src="${operatorSignature}" /><br><span class="badge">Signed</span>`
        : '<p style="color:#A0A0A0;font-size:12px">Pending signature</p>'}
      <p style="font-size:12px;color:#6B6B6B;margin-top:8px">${booking.operator?.name ?? ''}</p>
    </div>
  </div>

  <p style="text-align:center;color:#A0A0A0;font-size:11px;margin-top:32px">
    Generated by Rentivo - rentivo.domrol.com - ${new Date().toISOString()}
  </p>
</body>
</html>`
}

export async function generateAndSavePDF(html: string): Promise<string> {
  const { uri } = await Print.printToFileAsync({ html, base64: false })
  return uri
}

export async function sharePDF(uri: string): Promise<void> {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share rental contract',
    })
  }
}
