import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native'
import { Colors, Spacing, Radius } from '@/constants/colors'

interface WelcomeBackModalProps {
  visible: boolean
  onDismiss: () => void
  newVehicleCount?: number
  wishlistPriceDrop?: boolean
}

export function WelcomeBackModal({
  visible, onDismiss, newVehicleCount = 12, wishlistPriceDrop = false,
}: WelcomeBackModalProps) {
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.emoji}>👋</Text>
          <Text style={styles.title}>Welcome back!</Text>
          <View style={styles.updates}>
            {newVehicleCount > 0 && (
              <View style={styles.updateRow}>
                <Text style={styles.updateIcon}>🚗</Text>
                <Text style={styles.updateText}>
                  We've added {newVehicleCount} new vehicles in Marbella
                </Text>
              </View>
            )}
            {wishlistPriceDrop && (
              <View style={styles.updateRow}>
                <Text style={styles.updateIcon}>📉</Text>
                <Text style={styles.updateText}>
                  1 listing in your wishlist has a price drop
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={onDismiss}
            accessibilityLabel="Continue exploring"
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>Continue exploring →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: Spacing.xl, paddingBottom: 40,
    alignItems: 'center',
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  emoji: { fontSize: 56, marginBottom: Spacing.md },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, marginBottom: Spacing.xl },
  updates: { width: '100%', gap: Spacing.md, marginBottom: Spacing.xl },
  updateRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: Colors.surfaceWarm, borderRadius: Radius.lg,
    padding: Spacing.base, gap: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  updateIcon: { fontSize: 20 },
  updateText: { flex: 1, fontSize: 14, color: Colors.text, lineHeight: 22 },
  ctaBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.pill,
    paddingHorizontal: Spacing.xxxl, paddingVertical: Spacing.base,
  },
  ctaText: { fontSize: 16, fontWeight: '800', color: Colors.textInverse },
})
