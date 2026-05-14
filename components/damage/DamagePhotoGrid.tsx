import React from 'react'
import { View, StyleSheet } from 'react-native'
import { PhotoCapture } from '@/components/damage/PhotoCapture'
import { Spacing } from '@/constants/colors'

export type PhotoSlot = 'front' | 'back' | 'left' | 'right' | 'interior' | 'extra'

const SLOTS: { key: PhotoSlot; label: string }[] = [
  { key: 'front',    label: 'Front' },
  { key: 'back',     label: 'Back' },
  { key: 'left',     label: 'Left side' },
  { key: 'right',    label: 'Right side' },
  { key: 'interior', label: 'Interior' },
  { key: 'extra',    label: 'Extra' },
]

interface DamagePhotoGridProps {
  photos: Partial<Record<PhotoSlot, string | null>>
  onPhoto: (slot: PhotoSlot, uri: string) => void
}

export function DamagePhotoGrid({ photos, onPhoto }: DamagePhotoGridProps) {
  return (
    <View style={styles.grid}>
      {SLOTS.map(s => (
        <PhotoCapture
          key={s.key}
          label={s.label}
          uri={photos[s.key] ?? null}
          onCapture={uri => onPhoto(s.key, uri)}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    gap: 0,
  },
})
