import type { ComponentProps } from 'react'
import { Ionicons } from '@expo/vector-icons'
import type { RentalCategory } from '@/types'

export interface CategoryConfig {
  key: RentalCategory
  label: string
  icon: ComponentProps<typeof Ionicons>['name']
}

export const CATEGORIES: CategoryConfig[] = [
  { key: 'car',        label: 'Cars',       icon: 'car-outline' },
  { key: 'motorcycle', label: 'Motorcycles', icon: 'bicycle-outline' },
  { key: 'yacht',      label: 'Yachts',     icon: 'boat-outline' },
  { key: 'villa',      label: 'Villas',     icon: 'home-outline' },
  { key: 'bike',       label: 'Bikes',      icon: 'bicycle-outline' },
  { key: 'scooter',    label: 'Scooters',   icon: 'bicycle-outline' },
  { key: 'kayak',      label: 'Kayaks',     icon: 'boat-outline' },
  { key: 'surfboard',  label: 'Surfboards', icon: 'water-outline' },
  { key: 'equipment',  label: 'Equipment',  icon: 'construct-outline' },
  { key: 'other',      label: 'Other',      icon: 'cube-outline' },
]

export function getCategoryIcon(cat: RentalCategory): CategoryConfig['icon'] {
  return CATEGORIES.find(c => c.key === cat)?.icon ?? 'cube-outline'
}

export function getCategoryLabel(cat: RentalCategory): string {
  return CATEGORIES.find(c => c.key === cat)?.label ?? cat
}
