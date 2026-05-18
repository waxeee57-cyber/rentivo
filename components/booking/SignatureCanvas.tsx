import React, { useRef, useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Radius, Spacing } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'

interface SignatureCanvasProps {
  label?: string
  onSave: (signature: string) => void
  saved?: boolean
}

export function SignatureCanvas({ label, onSave, saved }: SignatureCanvasProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const SignatureComponent = require('react-native-signature-canvas').default

  const sigRef = useRef<{ readSignature: () => void; clearSignature: () => void } | null>(null)

  const handleOK = (sig: string) => {
    onSave(sig)
  }

  if (saved) {
    return (
      <View style={[styles.container, styles.savedContainer]}>
        <Text style={styles.savedText}>✓ Signed</Text>
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
        descriptionText="Sign here"
        clearText="Clear"
        confirmText="Confirm"
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
    fontWeight: '700',
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
  savedText: { color: C.success, fontWeight: '700', fontSize: 16 },
  })
}
