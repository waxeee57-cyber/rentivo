import React from 'react'
import { View, StyleSheet } from 'react-native'
import { PhotoCapture } from '@/components/damage/PhotoCapture'
import { Spacing } from '@/constants/colors'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { t } from '@/constants/i18n'
import type { TranslationKey } from '@/constants/i18n'

export type PhotoSlot = 'front' | 'back' | 'left' | 'right' | 'interior' | 'extra'

// Slot labels carry a KEY, not a string. They used to be hardcoded English,
// which meant an es/hu renter photographing a vehicle for a damage report — the
// evidence that decides whether their deposit is charged — was told "Left side"
// in a language they may not read. Every one of these keys already existed in
// constants/i18n.ts (photoFront/photoBack/... in all three locales); nothing but
// the lookup was missing. Resolved per render because `language` can change at
// runtime from the profile screen, so a module-level constant would go stale.
const SLOTS: { key: PhotoSlot; labelKey: TranslationKey }[] = [
  { key: 'front',    labelKey: 'photoFront' },
  { key: 'back',     labelKey: 'photoBack' },
  { key: 'left',     labelKey: 'photoLeft' },
  { key: 'right',    labelKey: 'photoRight' },
  { key: 'interior', labelKey: 'photoInterior' },
  { key: 'extra',    labelKey: 'photoExtra' },
]

interface DamagePhotoGridProps {
  photos: Partial<Record<PhotoSlot, string | null>>
  onPhoto: (slot: PhotoSlot, uri: string) => void
}

export function DamagePhotoGrid({ photos, onPhoto }: DamagePhotoGridProps) {
  const language = useAuthStore(s => s.language)
  return (
    <View style={styles.grid}>
      {SLOTS.map(s => (
        <PhotoCapture
          key={s.key}
          label={t(s.labelKey, language)}
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
