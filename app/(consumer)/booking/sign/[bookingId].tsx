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
import { useColors } from '@/lib/hooks/useColors'

export default function ConsumerSignScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>()
  const { showToast } = useToastStore()
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
      showToast({ message: 'Please sign before continuing', type: 'error' })
      return
    }
    setSigning(true)
    const signatureData = [...paths, currentPath].filter(Boolean).join(' ')

    if (!Config.useMock) {
      const { error } = await supabase
        .from('rentivo_bookings')
        .update({
          guest_signature: signatureData,
          guest_signed_at: new Date().toISOString(),
          contract_status: 'guest_signed',
        })
        .eq('id', bookingId ?? '')
      if (error) {
        showToast({ message: 'Signing failed. Please try again.', type: 'error' })
        setSigning(false)
        return
      }
    }

    showToast({ message: 'Contract signed successfully!', type: 'success' })
    setSigning(false)
    router.back()
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Sign Contract" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={styles.info}>
          <Text style={styles.infoTitle}>Rental Agreement</Text>
          <Text style={styles.infoText}>
            By signing below, you agree to the rental terms and conditions.
            This is an eIDAS-compliant Simple Electronic Signature (SES) under
            Regulation (EU) No 910/2014.
          </Text>
        </Card>

        <Card style={styles.padCard}>
          <Text style={styles.padLabel}>Sign here</Text>
          <View
            style={styles.signaturePad}
            {...panResponder.panHandlers}
            accessibilityLabel="Signature drawing area"
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
                <Text style={styles.placeholder}>Draw your signature above</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.clearBtn}
            onPress={clearSignature}
            accessibilityLabel="Clear signature"
          >
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        </Card>

        <Button
          title={signing ? 'Signing...' : 'Sign & Continue'}
          onPress={handleSign}
          loading={signing}
          disabled={!hasSignature || signing}
          fullWidth
          accessibilityLabel="Sign contract and continue"
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
