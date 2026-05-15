import type { ComponentProps } from 'react'
import { Ionicons } from '@expo/vector-icons'
import type { RentalCategory } from '@/types'

export interface CategoryConfig {
  key: RentalCategory
  label: string
  emoji: string
  icon: ComponentProps<typeof Ionicons>['name']
}

export const CATEGORIES: CategoryConfig[] = [
  { key: 'car',        label: 'Cars',       emoji: '🚗', icon: 'car-outline' },
  { key: 'motorcycle', label: 'Motorcycles', emoji: '🏍️', icon: 'bicycle-outline' },
  { key: 'yacht',      label: 'Yachts',     emoji: '⛵', icon: 'boat-outline' },
  { key: 'villa',      label: 'Villas',     emoji: '🏖️', icon: 'home-outline' },
  { key: 'bike',       label: 'Bikes',      emoji: '🚲', icon: 'bicycle-outline' },
  { key: 'scooter',    label: 'Scooters',   emoji: '🛵', icon: 'bicycle-outline' },
  { key: 'kayak',      label: 'Kayaks',     emoji: '🛶', icon: 'boat-outline' },
  { key: 'surfboard',  label: 'Surfboards', emoji: '🏄', icon: 'water-outline' },
  { key: 'equipment',  label: 'Equipment',  emoji: '🎿', icon: 'construct-outline' },
  { key: 'other',      label: 'Other',      emoji: '📦', icon: 'cube-outline' },
]

export function getCategoryEmoji(cat: RentalCategory): string {
  return CATEGORIES.find(c => c.key === cat)?.emoji ?? '📦'
}

export function getCategoryLabel(cat: RentalCategory): string {
  return CATEGORIES.find(c => c.key === cat)?.label ?? cat
}
