import React, { useState, useEffect, useMemo } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Spacing, Radius } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { ConfirmSheet } from '@/components/ui/ConfirmSheet'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToastStore } from '@/lib/store/useToastStore'
import { useListing } from '@/lib/hooks/useListing'
import { useCamera } from '@/lib/hooks/useCamera'
import { Image } from 'expo-image'
import { Config } from '@/constants/config'
import { MOCK_OPERATOR } from '@/lib/mockData'
import { CATEGORIES } from '@/constants/categories'
import type { CancellationPolicy, RentalCategory } from '@/types'
import { updateListing, deleteListing } from '@/lib/api/listings'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { supabase } from '@/lib/supabase'
import { PricingInsightWidget } from '@/components/operator/PricingInsightWidget'

const POLICIES: { key: CancellationPolicy; label: string; desc: string }[] = [
  { key: 'flexible', label: 'Flexible', desc: 'Full refund 1 day before' },
  { key: 'moderate', label: 'Moderate', desc: 'Full refund 5 days before' },
  { key: 'strict', label: 'Strict', desc: 'Full refund 14 days before' },
]

export default function EditVehicleScreen() {
  const C = useColors()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { listing, loading } = useListing(id ?? '')
  const { showToast } = useToastStore()
  const { showPhotoOptions } = useCamera()
  const { operator } = useAuthStore()
  const operatorId = Config.useMock ? MOCK_OPERATOR.id : (operator?.id ?? '')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [pricePerDay, setPricePerDay] = useState('')
  const [category, setCategory] = useState<RentalCategory>('car')
  const [available, setAvailable] = useState(true)
  const [minRentalDays, setMinRentalDays] = useState('1')
  const [policy, setPolicy] = useState<CancellationPolicy>('moderate')
  const [photos, setPhotos] = useState<(string | null)[]>(Array(6).fill(null))
  const [saving, setSaving] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [hourlyEnabled, setHourlyEnabled] = useState(false)
  const [pricePerHour, setPricePerHour] = useState('')
  const [minHours, setMinHours] = useState('2')
  const [requiresKyc, setRequiresKyc] = useState(false)

  useEffect(() => {
    if (listing && !initialized) {
      setTitle(listing.title)
      setDescription(listing.description ?? '')
      setPricePerDay(String(listing.price_per_day))
      setCategory(listing.category)
      setAvailable(listing.available)
      setMinRentalDays(String(listing.min_rental_days ?? 1))
      setPolicy(listing.cancellation_policy ?? 'moderate')
      if (listing.images?.length) {
        const slots: (string | null)[] = Array(6).fill(null)
        listing.images.slice(0, 6).forEach((img, i) => { slots[i] = img })
        setPhotos(slots)
      } else if (listing.cover_image_url) {
        const slots: (string | null)[] = Array(6).fill(null)
        slots[0] = listing.cover_image_url
        setPhotos(slots)
      }
      setHourlyEnabled(listing.hourly_rental_enabled ?? false)
      setPricePerHour(String(listing.price_per_hour ?? ''))
      setMinHours(String(listing.min_rental_hours ?? 2))
      setRequiresKyc(listing.operator?.requires_identity_verification ?? false)
      setInitialized(true)
    }
  }, [listing, initialized])

  const handlePickPhoto = async (index: number) => {
    const uri = await showPhotoOptions()
    if (uri) {
      setPhotos(prev => {
        const next = [...prev]
        next[index] = uri
        return next
      })
    }
  }

  const handleSave = async () => {
    if (!title.trim()) {
      showToast({ message: 'Vehicle name is required', type: 'error' })
      return
    }
    const price = parseFloat(pricePerDay)
    if (isNaN(price) || price <= 0) {
      showToast({ message: 'Valid price per day is required', type: 'error' })
      return
    }
    setSaving(true)
    try {
      const validPhotos = photos.filter((p): p is string => p !== null)
      await updateListing(
        id ?? '',
        {
          title: title.trim(),
          description: description.trim() || undefined,
          price_per_day: price,
          category,
          available,
          min_rental_days: parseInt(minRentalDays, 10),
          cancellation_policy: policy,
          cover_image_url: validPhotos[0] ?? undefined,
          images: validPhotos.length > 0 ? validPhotos : undefined,
          hourly_rental_enabled: hourlyEnabled,
          price_per_hour: hourlyEnabled ? (parseFloat(pricePerHour) || null) : null,
          min_rental_hours: hourlyEnabled ? (parseInt(minHours, 10) || 2) : null,
        },
        operatorId,
      )
      if (!Config.useMock && requiresKyc !== (listing?.operator?.requires_identity_verification ?? false)) {
        await supabase
          .from('rentivo_operators')
          .update({ requires_identity_verification: requiresKyc })
          .eq('id', operatorId)
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      showToast({ message: 'Updated ✓', type: 'success' })
      router.back()
    } catch {
      showToast({ message: 'Failed to save changes', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      if (Config.useMock) {
        await new Promise<void>(r => setTimeout(r, 600))
      } else {
        await deleteListing(id ?? '', operatorId)
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      showToast({ message: 'Vehicle removed', type: 'info' })
      router.replace('/(operator)/fleet' as Parameters<typeof router.replace>[0])
    } catch {
      showToast({ message: 'Failed to delete vehicle', type: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  const styles = useMemo(() => makeStyles(C), [C])

  if (loading || !listing) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScreenHeader title="Edit vehicle" />
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title="Edit vehicle" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Photos */}
        <Text style={styles.sectionTitle}>Photos</Text>
        <View style={styles.photoGrid}>
          {photos.map((uri, i) => (
            <TouchableOpacity
              key={i}
              style={styles.photoSlot}
              onPress={() => handlePickPhoto(i)}
              accessibilityLabel={uri ? `Change photo ${i + 1}` : `Add photo ${i + 1}`}
              accessibilityRole="button"
            >
              {uri ? (
                <Image source={{ uri }} style={styles.photoImg} contentFit="cover" />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoPlaceholderIcon}>📷</Text>
                  <Text style={styles.photoPlaceholderText}>{i === 0 ? 'Cover' : `Photo ${i + 1}`}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Vehicle name */}
        <Text style={styles.sectionTitle}>Vehicle name</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Mercedes-Benz E-Class"
          placeholderTextColor={C.textTertiary}
          accessibilityLabel="Vehicle name"
        />

        {/* Category */}
        <Text style={styles.sectionTitle}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.key}
              style={[styles.catChip, category === cat.key && styles.catChipActive]}
              onPress={() => setCategory(cat.key)}
              accessibilityLabel={cat.label}
              accessibilityRole="radio"
              accessibilityState={{ selected: category === cat.key }}
            >
              <Text style={styles.catEmoji}>{cat.emoji}</Text>
              <Text style={[styles.catLabel, category === cat.key && styles.catLabelActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Price */}
        <Text style={styles.sectionTitle}>Price per day (€)</Text>
        <TextInput
          style={styles.input}
          value={pricePerDay}
          onChangeText={setPricePerDay}
          placeholder="e.g. 75"
          placeholderTextColor={C.textTertiary}
          keyboardType="numeric"
          accessibilityLabel="Price per day"
        />

        {/* AI Pricing Insights */}
        <PricingInsightWidget
          listingId={listing.id}
          city={listing.operator?.city ?? listing.host?.city ?? ''}
          category={listing.category}
          currentPrice={listing.price_per_day}
        />

        {/* Description */}
        <Text style={styles.sectionTitle}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe your vehicle, features, included extras…"
          placeholderTextColor={C.textTertiary}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          accessibilityLabel="Description"
        />

        {/* Availability */}
        <Card style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Text style={styles.toggleTitle}>Available for booking</Text>
              <Text style={styles.toggleSub}>
                {available ? 'Visible to travellers' : 'Hidden from search results'}
              </Text>
            </View>
            <Switch
              value={available}
              onValueChange={v => {
                setAvailable(v)
                void Haptics.impactAsync(v ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light)
              }}
              trackColor={{ true: C.success, false: C.border }}
              thumbColor={C.surface}
              accessibilityLabel={`Vehicle: ${available ? 'available' : 'unavailable'}`}
              accessibilityRole="switch"
              accessibilityState={{ checked: available }}
            />
          </View>
        </Card>

        {/* Min rental days */}
        <Text style={styles.sectionTitle}>Minimum rental days</Text>
        <View style={styles.minDaysRow}>
          {[1, 2, 3, 5, 7].map(d => (
            <TouchableOpacity
              key={d}
              style={[styles.dayChip, minRentalDays === String(d) && styles.dayChipActive]}
              onPress={() => setMinRentalDays(String(d))}
              accessibilityLabel={`${d} day${d > 1 ? 's' : ''} minimum`}
              accessibilityRole="radio"
              accessibilityState={{ selected: minRentalDays === String(d) }}
            >
              <Text style={[styles.dayChipText, minRentalDays === String(d) && styles.dayChipTextActive]}>
                {d}d
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Cancellation policy */}
        <Text style={styles.sectionTitle}>Cancellation policy</Text>
        {POLICIES.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[styles.policyRow, policy === p.key && styles.policyRowActive]}
            onPress={() => setPolicy(p.key)}
            accessibilityLabel={`${p.label}: ${p.desc}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: policy === p.key }}
          >
            <View style={[styles.radio, policy === p.key && styles.radioActive]}>
              {policy === p.key && <View style={styles.radioDot} />}
            </View>
            <View style={styles.policyText}>
              <Text style={styles.policyLabel}>{p.label}</Text>
              <Text style={styles.policyDesc}>{p.desc}</Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* Hourly Rental */}
        <Text style={styles.sectionTitle}>Hourly Rental</Text>
        <Card style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Text style={styles.toggleTitle}>Enable hourly booking</Text>
              <Text style={styles.toggleSub}>
                {hourlyEnabled ? 'Travellers can book by the hour' : 'Daily booking only'}
              </Text>
            </View>
            <Switch
              value={hourlyEnabled}
              onValueChange={v => {
                setHourlyEnabled(v)
                void Haptics.impactAsync(v ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light)
              }}
              trackColor={{ false: C.border, true: C.primary }}
              thumbColor={C.surface}
              accessibilityLabel={`Hourly rental: ${hourlyEnabled ? 'enabled' : 'disabled'}`}
              accessibilityRole="switch"
              accessibilityState={{ checked: hourlyEnabled }}
            />
          </View>
          {hourlyEnabled && (
            <View style={styles.hourlyFields}>
              <Text style={styles.hourlyFieldLabel}>Price per hour (€)</Text>
              <TextInput
                style={styles.input}
                value={pricePerHour}
                onChangeText={setPricePerHour}
                keyboardType="decimal-pad"
                placeholder="25.00"
                placeholderTextColor={C.textTertiary}
                accessibilityLabel="Price per hour in euros"
              />
              <Text style={[styles.hourlyFieldLabel, { marginTop: Spacing.md }]}>Minimum hours</Text>
              <View style={styles.minHoursRow}>
                {[1, 2, 3, 4, 6, 8].map(h => (
                  <TouchableOpacity
                    key={h}
                    style={[styles.dayChip, minHours === String(h) && styles.dayChipActive]}
                    onPress={() => setMinHours(String(h))}
                    accessibilityLabel={`Minimum ${h} hour${h > 1 ? 's' : ''}`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: minHours === String(h) }}
                  >
                    <Text style={[styles.dayChipText, minHours === String(h) && styles.dayChipTextActive]}>
                      {h}h
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </Card>

        {/* Identity Verification Requirement */}
        <Text style={styles.sectionTitle}>Identity Verification</Text>
        <Card style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Text style={styles.toggleTitle}>Require Identity Verification</Text>
              <Text style={styles.toggleSub}>Guests must verify ID before booking</Text>
            </View>
            <Switch
              value={requiresKyc}
              onValueChange={v => {
                setRequiresKyc(v)
                void Haptics.impactAsync(v ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light)
              }}
              trackColor={{ false: C.border, true: C.primary }}
              thumbColor={C.surface}
              accessibilityLabel={`Require identity verification: ${requiresKyc ? 'enabled' : 'disabled'}`}
              accessibilityRole="switch"
              accessibilityState={{ checked: requiresKyc }}
            />
          </View>
        </Card>

        <Button
          title="Save changes"
          onPress={handleSave}
          loading={saving}
          fullWidth
          style={{ marginTop: Spacing.xl }}
        />

        <TouchableOpacity
          style={styles.icalBtn}
          onPress={() => router.push(`/(operator)/fleet/ical-sync/${id}` as Parameters<typeof router.push>[0])}
          accessibilityLabel="iCal sync"
          accessibilityRole="button"
        >
          <Text style={styles.icalBtnText}>📅 iCal Sync</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.pricingBtn}
          onPress={() => router.push(`/(operator)/fleet/pricing/${id}` as Parameters<typeof router.push>[0])}
          accessibilityLabel="Edit pricing rules"
          accessibilityRole="button"
        >
          <Text style={styles.pricingBtnText}>📊 Pricing Rules</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.availabilityBtn}
          onPress={() => router.push(`/(operator)/fleet/availability/${id}` as Parameters<typeof router.push>[0])}
          accessibilityLabel="Manage availability"
          accessibilityRole="button"
        >
          <Text style={styles.availabilityBtnText}>📅 Manage Availability</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => setShowDelete(true)}
          accessibilityLabel="Delete this vehicle"
          accessibilityRole="button"
        >
          <Text style={styles.deleteBtnText}>🗑 Delete vehicle</Text>
        </TouchableOpacity>

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>

      <ConfirmSheet
        visible={showDelete}
        title="Delete this vehicle?"
        message="This will remove the vehicle from your fleet. Active bookings will not be affected."
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        confirmVariant="danger"
        onConfirm={() => void handleDelete()}
        onCancel={() => setShowDelete(false)}
      />
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xxxl },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 15, color: C.textSecondary },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: C.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: Spacing.xl, marginBottom: Spacing.sm,
  },
  photoGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm,
  },
  photoSlot: {
    width: '31%', aspectRatio: 1,
    backgroundColor: C.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },
  photoImg: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  photoPlaceholderIcon: { fontSize: 24 },
  photoPlaceholderText: { fontSize: 11, color: C.textTertiary, fontWeight: '600' },
  input: {
    backgroundColor: C.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    fontSize: 15, color: C.text,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top', paddingTop: Spacing.md },
  categoryScroll: { marginBottom: Spacing.xs },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: C.surface, borderRadius: Radius.pill,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    marginRight: Spacing.sm,
  },
  catChipActive: { backgroundColor: C.primarySurface, borderColor: C.primary },
  catEmoji: { fontSize: 16 },
  catLabel: { fontSize: 13, fontWeight: '600', color: C.textSecondary },
  catLabelActive: { color: C.primaryDark },
  card: { marginTop: Spacing.xl },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLeft: { flex: 1, marginRight: Spacing.md },
  toggleTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 2 },
  toggleSub: { fontSize: 13, color: C.textSecondary },
  minDaysRow: { flexDirection: 'row', gap: Spacing.sm },
  dayChip: {
    flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.lg,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center',
  },
  dayChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  dayChipText: { fontSize: 14, fontWeight: '700', color: C.textSecondary },
  dayChipTextActive: { color: C.textInverse },
  policyRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: C.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: C.border,
    padding: Spacing.md, marginBottom: Spacing.sm,
  },
  policyRowActive: { borderColor: C.primary, backgroundColor: C.primarySurface },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: C.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary },
  policyText: { flex: 1 },
  policyLabel: { fontSize: 15, fontWeight: '700', color: C.text },
  policyDesc: { fontSize: 13, color: C.textSecondary, marginTop: 2 },
  icalBtn: {
    marginTop: Spacing.sm, padding: Spacing.md, alignItems: 'center',
    borderWidth: 1.5, borderColor: C.primary,
    borderRadius: Radius.lg, backgroundColor: C.primarySurface,
    minHeight: 48,
  },
  icalBtnText: { fontSize: 15, fontWeight: '700', color: C.primary },
  pricingBtn: {
    marginTop: Spacing.sm, padding: Spacing.md, alignItems: 'center',
    borderWidth: 1, borderColor: C.borderGold,
    borderRadius: Radius.lg, backgroundColor: C.surface,
    minHeight: 44,
  },
  pricingBtnText: { color: C.primary, fontWeight: '600', fontSize: 14 },
  availabilityBtn: {
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: C.primary,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  availabilityBtnText: { fontSize: 14, color: C.primary, fontWeight: '600' },
  deleteBtn: {
    marginTop: Spacing.base, padding: Spacing.md, alignItems: 'center',
    borderWidth: 1.5, borderColor: C.error + '55',
    borderRadius: Radius.lg, backgroundColor: C.errorSurface,
  },
  deleteBtnText: { fontSize: 15, fontWeight: '700', color: C.error },
  hourlyFields: { marginTop: Spacing.base, gap: Spacing.xs },
  hourlyFieldLabel: { fontSize: 13, fontWeight: '600', color: C.textSecondary, marginBottom: Spacing.xs },
  minHoursRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  })
}
