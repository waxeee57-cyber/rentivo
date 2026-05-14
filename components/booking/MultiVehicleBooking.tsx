import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { formatEUR, formatEURDecimal } from '@/lib/utils/formatCurrency'
import type { Listing } from '@/types'

interface MultiVehicleBookingProps {
  primaryListing: Listing
  onDismiss: () => void
}

const BUNDLE_DISCOUNT = 0.10 // 10%

export function MultiVehicleBooking({ primaryListing, onDismiss }: MultiVehicleBookingProps) {
  const [selectedListings, setSelectedListings] = useState<Listing[]>([primaryListing])

  const totalPerDay = selectedListings.reduce((sum, l) => sum + l.price_per_day, 0)
  const discountedTotal = Math.round(totalPerDay * (1 - BUNDLE_DISCOUNT))
  const savings = totalPerDay - discountedTotal

  const toggleListing = (listing: Listing) => {
    setSelectedListings(prev => {
      const exists = prev.some(l => l.id === listing.id)
      if (exists) {
        return prev.filter(l => l.id !== listing.id)
      }
      return [...prev, listing]
    })
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Multi-vehicle booking</Text>
        <Text style={styles.subtitle}>Add vehicles and get 10% bundle discount</Text>
      </View>

      <View style={styles.selectedList}>
        {selectedListings.map(l => (
          <View key={l.id} style={styles.selectedRow}>
            <View style={styles.vehicleInfo}>
              <Text style={styles.vehicleName} numberOfLines={1}>{l.title}</Text>
              <Text style={styles.vehiclePrice}>{formatEUR(l.price_per_day)}/day</Text>
            </View>
            {l.id !== primaryListing.id && (
              <TouchableOpacity
                onPress={() => toggleListing(l)}
                style={styles.removeVehicle}
                accessibilityLabel={`Remove ${l.title}`}
                accessibilityRole="button"
              >
                <Text style={styles.removeText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      {selectedListings.length > 1 && (
        <View style={styles.discountBanner}>
          <Text style={styles.discountTitle}>🏷️ Bundle discount applied</Text>
          <View style={styles.discountRow}>
            <Text style={styles.discountLabel}>Original</Text>
            <Text style={styles.discountOriginal}>{formatEUR(totalPerDay)}/day</Text>
          </View>
          <View style={styles.discountRow}>
            <Text style={styles.discountLabel}>Discount (10%)</Text>
            <Text style={styles.discountSavings}>–{formatEUR(savings)}</Text>
          </View>
          <View style={[styles.discountRow, styles.discountTotal]}>
            <Text style={styles.discountTotalLabel}>Bundle total</Text>
            <Text style={styles.discountTotalValue}>{formatEUR(discountedTotal)}/day</Text>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={styles.bookBtn}
        onPress={() => {
          onDismiss()
          router.push(`/(consumer)/booking/${primaryListing.id}`)
        }}
        accessibilityLabel="Book all vehicles"
        accessibilityRole="button"
      >
        <Text style={styles.bookBtnText}>
          Book {selectedListings.length} vehicle{selectedListings.length > 1 ? 's' : ''} →
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { padding: Spacing.base },
  header: { marginBottom: Spacing.base },
  title: { fontSize: 18, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  selectedList: { gap: Spacing.sm, marginBottom: Spacing.base },
  selectedRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surfaceWarm, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  vehicleInfo: { flex: 1 },
  vehicleName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  vehiclePrice: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  removeVehicle: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.errorSurface,
    alignItems: 'center', justifyContent: 'center',
  },
  removeText: { fontSize: 11, color: Colors.error, fontWeight: '700' },
  discountBanner: {
    backgroundColor: Colors.primarySurface, borderRadius: Radius.lg,
    padding: Spacing.base, marginBottom: Spacing.base,
    borderWidth: 1, borderColor: Colors.primaryLight,
  },
  discountTitle: { fontSize: 14, fontWeight: '700', color: Colors.primaryDark, marginBottom: Spacing.sm },
  discountRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  discountLabel: { fontSize: 13, color: Colors.textSecondary },
  discountOriginal: { fontSize: 13, color: Colors.textTertiary, textDecorationLine: 'line-through' },
  discountSavings: { fontSize: 13, color: Colors.success, fontWeight: '600' },
  discountTotal: {
    borderTopWidth: 1, borderTopColor: Colors.primaryLight,
    paddingTop: Spacing.sm, marginTop: 4,
  },
  discountTotalLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  discountTotalValue: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  bookBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.pill,
    paddingVertical: Spacing.base, alignItems: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  bookBtnText: { fontSize: 16, fontWeight: '800', color: Colors.textInverse },
})
