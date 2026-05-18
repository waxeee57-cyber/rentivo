import React, { useMemo } from 'react'
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
} from 'react-native'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'

interface Detail {
  label: string
  value: string
}

interface ConfirmSheetProps {
  visible: boolean
  title: string
  message: string
  confirmLabel: string
  confirmVariant?: 'primary' | 'danger'
  onConfirm: () => void
  onCancel: () => void
  details?: Detail[]
}

export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
  details,
}: ConfirmSheetProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onCancel}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onCancel}
      />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>

        {details && details.length > 0 && (
          <View style={styles.detailsBox}>
            {details.map((d, i) => (
              <View key={i} style={[styles.detailRow, i > 0 && styles.detailRowBorder]}>
                <Text style={styles.detailLabel}>{d.label}</Text>
                <Text style={styles.detailValue}>{d.value}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.confirmBtn,
              confirmVariant === 'danger' && styles.confirmBtnDanger,
            ]}
            onPress={onConfirm}
          >
            <Text style={[
              styles.confirmText,
              confirmVariant === 'danger' && styles.confirmTextDanger,
            ]}>
              {confirmLabel}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: C.overlay,
  },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: C.border,
    borderRadius: Radius.pill,
    alignSelf: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: C.text,
    marginBottom: Spacing.sm,
  },
  message: {
    fontSize: 15,
    color: C.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  detailsBox: {
    backgroundColor: C.surfaceWarm,
    borderRadius: Radius.lg,
    marginBottom: Spacing.xl,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
  },
  detailRowBorder: {
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  detailLabel: {
    fontSize: 14,
    color: C.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: C.textSecondary,
  },
  confirmBtn: {
    flex: 2,
    height: 50,
    borderRadius: Radius.lg,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDanger: {
    backgroundColor: C.errorSurface,
    borderWidth: 1,
    borderColor: C.error,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: C.textInverse,
  },
  confirmTextDanger: {
    color: C.error,
  },
  })
}
