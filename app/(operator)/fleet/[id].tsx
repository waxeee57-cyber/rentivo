import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { ConfirmSheet } from '@/components/ui/ConfirmSheet'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToastStore } from '@/lib/store/useToastStore'
import { useListing } from '@/lib/hooks/useListing'
import { useCamera } from '@/lib/hooks/useCamera'
import { Image } from 'expo-image'
import { Config } from '@/constants/config'
import { CATEGORIES } from '@/constants/categories'
import type { CancellationPolicy, RentalCategory } from '@/types'

const POLICIES: { key: CancellationPolicy; label: string; desc: string }[] = [
  { key: 'flexible', label: 'Flexible', desc: 'Full refund 1 day before' },
  { key: 'moderate', label: 'Moderate', desc: 'Full refund 5 days before' },
  { key: 'strict', label: 'Strict', desc: 'Full refund 14 days before' },
]

export default function EditVehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { listing, loading } = useListing(id ?? '')
  const { showToast } = useToastStore()
  const { showPhotoOptions } = useCamera()

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
    setSaving(true)
    try {
      await new Promise<void>(r => setTimeout(r, 600))
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      showToast({ message: 'Updated ✓', type: 'success' })
      router.back()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await new Promise<void>(r => setTimeout(r, 600))
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      showToast({ message: 'Vehicle removed', type: 'info' })
      router.back()
    } finally {
      setDeleting(false)
    }
  }

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
          placeholderTextColor={Colors.textTertiary}
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
          placeholderTextColor={Colors.textTertiary}
          keyboardType="numeric"
          accessibilityLabel="Price per day"
        />

        {/* Description */}
        <Text style={styles.sectionTitle}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe your vehicle, features, included extras…"
          placeholderTextColor={Colors.textTertiary}
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
              trackColor={{ true: Colors.success, false: Colors.border }}
              thumbColor={Colors.surface}
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

        <Button
          title="Save changes"
          onPress={handleSave}
          loading={saving}
          fullWidth
          style={{ marginTop: Spacing.xl }}
        />

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xxxl },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 15, color: Colors.textSecondary },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: Colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: Spacing.xl, marginBottom: Spacing.sm,
  },
  photoGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm,
  },
  photoSlot: {
    width: '31%', aspectRatio: 1,
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  photoImg: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  photoPlaceholderIcon: { fontSize: 24 },
  photoPlaceholderText: { fontSize: 11, color: Colors.textTertiary, fontWeight: '600' },
  input: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    fontSize: 15, color: Colors.text,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top', paddingTop: Spacing.md },
  categoryScroll: { marginBottom: Spacing.xs },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.surface, borderRadius: Radius.pill,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    marginRight: Spacing.sm,
  },
  catChipActive: { backgroundColor: Colors.primarySurface, borderColor: Colors.primary },
  catEmoji: { fontSize: 16 },
  catLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  catLabelActive: { color: Colors.primaryDark },
  card: { marginTop: Spacing.xl },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLeft: { flex: 1, marginRight: Spacing.md },
  toggleTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  toggleSub: { fontSize: 13, color: Colors.textSecondary },
  minDaysRow: { flexDirection: 'row', gap: Spacing.sm },
  dayChip: {
    flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.lg,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  dayChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayChipText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  dayChipTextActive: { color: Colors.textInverse },
  policyRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, marginBottom: Spacing.sm,
  },
  policyRowActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: Colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  policyText: { flex: 1 },
  policyLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },
  policyDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  deleteBtn: {
    marginTop: Spacing.base, padding: Spacing.md, alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.error + '55',
    borderRadius: Radius.lg, backgroundColor: Colors.errorSurface,
  },
  deleteBtnText: { fontSize: 15, fontWeight: '700', color: Colors.error },
})
