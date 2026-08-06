import React, { useRef, useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Radius, Spacing, Fonts } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { t } from '@/constants/i18n'

interface SignatureCanvasProps {
  label?: string
  onSave: (signature: string) => void
  saved?: boolean
}

export function SignatureCanvas({ label, onSave, saved }: SignatureCanvasProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  // This is the control a renter signs a legally binding rental agreement with.
  // Its three visible strings were hardcoded English while every screen around
  // it was translated, so an es/hu renter was signing against copy they may not
  // read. All three keys already existed in constants/i18n.ts.
  const language = useAuthStore(s => s.language)
  const SignatureComponent = require('react-native-signature-canvas').default

  const sigRef = useRef<{ readSignature: () => void; clearSignature: () => void } | null>(null)

  const handleOK = (sig: string) => {
    onSave(sig)
  }

  if (saved) {
    return (
      <View style={[styles.container, styles.savedContainer]}>
        <Text style={styles.savedText}>{`✓ ${t('opDmgSigned', language)}`}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <SignatureComponent
        ref={sigRef}
        onOK={handleOK}
        onEmpty={() => {}}
        descriptionText={t('signHere', language)}
        clearText={t('clearSignature', language)}
        confirmText={t('confirm', language)}
        style={{ height: 180 }}
        webStyle={`
          .m-signature-pad { box-shadow: none; border: 1px solid #E8E4DC; border-radius: 12px; }
          .m-signature-pad--footer { background: #FAFAF8; }
          .m-signature-pad--footer .button { background: #E8A44A; color: white; border-radius: 8px; }
        `}
      />
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.base,
  },
  label: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    padding: Spacing.md,
    backgroundColor: C.surfaceWarm,
  },
  savedContainer: {
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.successSurface,
    borderColor: C.success,
  },
  savedText: { color: C.success, fontFamily: Fonts.bold, fontSize: 16 },
  })
}
