import React, { useState, useRef, useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { router, useLocalSearchParams } from 'expo-router'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToastStore } from '@/lib/store/useToastStore'
import { Config } from '@/constants/config'
import { supabase } from '@/lib/supabase'
import { captureException } from '@/lib/sentry'
import { useColors } from '@/lib/hooks/useColors'
import { t } from '@/constants/i18n'
import { useAuthStore } from '@/lib/store/useAuthStore'

export default function OperatorSignScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>()
  const { showToast } = useToastStore()
  const { language } = useAuthStore()
  const [paths, setPaths] = useState<string[]>([])
  const [currentPath, setCurrentPath] = useState('')
  const [signing, setSigning] = useState(false)
  const hasSignature = paths.length > 0 || currentPath.length > 0

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent
        setCurrentPath(`M${locationX},${locationY}`)
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent
        setCurrentPath((prev) => `${prev} L${locationX},${locationY}`)
      },
      onPanResponderRelease: () => {
        setCurrentPath((prev) => {
          if (prev) {
            setPaths((ps) => [...ps, prev])
          }
          return ''
        })
      },
    })
  ).current

  const clearSignature = () => {
    setPaths([])
    setCurrentPath('')
  }

  const handleSign = async () => {
    if (!hasSignature) {
      showToast({ message: t('opBkToastSignFirst', language), type: 'error' })
      return
    }
    setSigning(true)
    const signatureData = [...paths, currentPath].filter(Boolean).join(' ')

    if (!Config.useMock) {
      const failSign = (err: unknown, scope: string) => {
        showToast({ message: t('opBkToastSignFail', language), type: 'error' })
        captureException(err, { scope, bookingId })
        setSigning(false)
      }

      // The UPDATE had no `.select()`. supabase-js reports no error for an update
      // that matched zero rows, so a booking this operator is not permitted to
      // touch — or a bookingId that does not exist — produced "Contract signed"
      // over a signature column still holding NULL. Reading the affected rows back
      // is the only way to tell a write that landed from one that did not.
      const { data, error } = await supabase
        .from('rentivo_bookings')
        .update({
          operator_signature_data: signatureData,
          operator_signed_at: new Date().toISOString(),
        })
        .eq('id', bookingId ?? '')
        .select('id, guest_signature, operator_signature_data')

      if (error || !data || data.length === 0) {
        failSign(error ?? new Error('Signature update matched no booking row'), 'opBooking.sign')
        return
      }

      // contract_status was hardcoded to 'fully_signed'. Signing as the operator
      // before the guest has signed therefore declared a two-party rental contract
      // complete while guest_signature was still NULL. Derive it from what is
      // actually stored: documented states are pending | guest_signed | fully_signed,
      // so an operator-first signature leaves the contract pending until the guest
      // signs, and operator_signed_at is what records that this side is done.
      const bothSigned = !!data[0].guest_signature && !!data[0].operator_signature_data
      const { data: statusData, error: statusError } = await supabase
        .from('rentivo_bookings')
        .update({ contract_status: bothSigned ? 'fully_signed' : 'pending' })
        .eq('id', bookingId ?? '')
        .select('id')

      if (statusError || !statusData || statusData.length === 0) {
        failSign(statusError ?? new Error('Contract status update matched no booking row'), 'opBooking.sign.status')
        return
      }
    }

    showToast({ message: t('opBkToastSigned', language), type: 'success' })
    setSigning(false)
    router.back()
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title={t('opBkSignTitle', language)} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={styles.info}>
          <Text style={styles.infoTitle}>{t('rentalAgreement', language)}</Text>
          <Text style={styles.infoText}>
            By signing below, you confirm the rental terms as the operator.
            This is an eIDAS-compliant Simple Electronic Signature (SES) under
            Regulation (EU) No 910/2014.
          </Text>
        </Card>

        <Card style={styles.padCard}>
          <Text style={styles.padLabel}>{t('signHere', language)}</Text>
          <View
            style={styles.signaturePad}
            {...panResponder.panHandlers}
            accessibilityLabel={t('opBkSigArea', language)}
          >
            <Svg width="100%" height={160}>
              {paths.map((p, i) => (
                <Path
                  key={i}
                  d={p}
                  stroke={C.primary}
                  strokeWidth={2}
                  fill="none"
                />
              ))}
              {currentPath ? (
                <Path
                  d={currentPath}
                  stroke={C.primary}
                  strokeWidth={2}
                  fill="none"
                />
              ) : null}
            </Svg>
            {!hasSignature && (
              <View style={styles.placeholderContainer} pointerEvents="none">
                <Text style={styles.placeholder}>{t('opBkDrawSignature', language)}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.clearBtn}
            onPress={clearSignature}
            accessibilityLabel={t('opBkClearSigLabel', language)}
            accessibilityRole="button"
          >
            <Text style={styles.clearText}>{t('clearSignature', language)}</Text>
          </TouchableOpacity>
        </Card>

        <Button
          title={signing ? t('opBkSigning', language) : t('opBkSignConfirm', language)}
          onPress={handleSign}
          loading={signing}
          disabled={!hasSignature || signing}
          fullWidth
          accessibilityLabel={t('opBkSignConfirmLabel', language)}
        />
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  content: {
    padding: Spacing.base,
    paddingBottom: 100,
  },
  info: {
    marginBottom: Spacing.base,
  },
  infoTitle: {
    color: C.text,
    fontSize: 16,
    fontFamily: Fonts.bold,
    marginBottom: 8,
  },
  infoText: {
    color: C.textSecondary,
    fontFamily: Fonts.regular, fontSize: 13,
    lineHeight: 20,
  },
  padCard: {
    marginBottom: Spacing.base,
  },
  padLabel: {
    color: C.textSecondary,
    fontFamily: Fonts.regular, fontSize: 13,
    marginBottom: 8,
  },
  signaturePad: {
    height: 160,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.sm,
    backgroundColor: C.surface,
    overflow: 'hidden',
  },
  placeholderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    color: C.textTertiary,
    fontFamily: Fonts.regular, fontSize: 14,
  },
  clearBtn: {
    marginTop: 8,
    alignSelf: 'flex-end',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  clearText: {
    color: C.error,
    fontFamily: Fonts.regular, fontSize: 14,
  },
  })
}
