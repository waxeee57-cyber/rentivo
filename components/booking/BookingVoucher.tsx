import React, { useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { WebView } from 'react-native-webview'
import * as Sharing from 'expo-sharing'
import { Spacing, Radius, Typography, Shadow } from '@/constants/colors'
import { t } from '@/constants/i18n'
import { useColors } from '@/lib/hooks/useColors'

export interface VoucherData {
  /** Booking UUID */
  id: string
  listingTitle?: string
  startDate?: string
  endDate?: string
  guestName?: string
}

interface Props {
  voucher: VoucherData
  language?: 'en' | 'es' | 'hu'
}

/** Renders a QR code via an inline HTML page inside a WebView (no native module needed). */
function QRCodeView({ value, size }: { value: string; size: number }): React.JSX.Element {
  const html = `<!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <style>body{margin:0;background:white;display:flex;align-items:center;justify-content:center}</style>
    <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
  </head><body>
    <div id="qr"></div>
    <script>new QRCode(document.getElementById("qr"),{text:${JSON.stringify(value)},width:${size},height:${size},correctLevel:QRCode.CorrectLevel.M});</script>
  </body></html>`
  return (
    <WebView
      originWhitelist={['*']}
      source={{ html }}
      style={{ width: size, height: size, backgroundColor: 'white' }}
      scrollEnabled={false}
    />
  )
}

export default function BookingVoucher({ voucher, language = 'en' }: Props) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const qrPayload = JSON.stringify({
    id: voucher.id,
    listing: voucher.listingTitle ?? '',
    start: voucher.startDate ?? '',
    end: voucher.endDate ?? '',
    guest: voucher.guestName ?? '',
  })

  const shortRef = voucher.id.slice(0, 8).toUpperCase()

  const handleShare = async (): Promise<void> => {
    try {
      const isAvailable = await Sharing.isAvailableAsync()
      if (!isAvailable) {
        Alert.alert('Sharing not available on this device')
        return
      }
      // expo-sharing requires a file URI — a full PDF export via expo-print
      // can be wired here in a future iteration (JÖVŐBENI KAPU)
      Alert.alert(
        t('voucherShare', language),
        `Booking ref: #${shortRef}\n${qrPayload}`,
      )
    } catch {
      // Sharing dismissed or failed — silently ignore
    }
  }

  return (
    <View style={styles.voucher} accessibilityLabel={`Booking voucher ${shortRef}`}>
      <Text style={styles.title}>{t('voucherTitle', language)}</Text>

      <View style={styles.qrContainer}>
        <QRCodeView value={qrPayload} size={180} />
      </View>

      <Text style={styles.bookingId}>#{shortRef}</Text>

      {voucher.listingTitle != null && (
        <Text style={styles.details}>{voucher.listingTitle}</Text>
      )}

      {voucher.startDate != null && voucher.endDate != null && (
        <Text style={styles.dates}>
          {voucher.startDate} — {voucher.endDate}
        </Text>
      )}

      {voucher.guestName != null && (
        <Text style={styles.guest}>{voucher.guestName}</Text>
      )}

      <Text style={styles.offlineHint}>
        {t('voucherOfflineHint', language)}
      </Text>

      <TouchableOpacity
        style={styles.shareBtn}
        onPress={handleShare}
        accessibilityLabel={t('voucherShare', language)}
        accessibilityRole="button"
      >
        <Text style={styles.shareBtnText}>
          {t('voucherShare', language)}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  voucher: {
    backgroundColor: C.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    marginVertical: Spacing.md,
    ...Shadow.md,
  },
  title: {
    ...Typography.h3,
    color: C.text,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  qrContainer: {
    backgroundColor: C.white,
    padding: Spacing.base,
    borderRadius: Radius.md,
    marginBottom: Spacing.lg,
    ...Shadow.sm,
  },
  bookingId: {
    ...Typography.h2,
    color: C.primary,
    letterSpacing: 2,
    marginBottom: Spacing.sm,
  },
  details: {
    fontSize: 16,
    color: C.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  dates: {
    fontSize: 14,
    color: C.textSecondary,
    marginBottom: Spacing.sm,
  },
  guest: {
    fontSize: 13,
    color: C.textTertiary,
    marginBottom: Spacing.md,
  },
  offlineHint: {
    fontSize: 12,
    color: C.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: Spacing.lg,
  },
  shareBtn: {
    minHeight: 44,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: C.borderGold,
    backgroundColor: C.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.primary,
  },
  })
}
