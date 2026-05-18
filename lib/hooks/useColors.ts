import { getColors } from '@/constants/colors'
import { useThemeStore } from '@/lib/store/useThemeStore'

export function useColors() {
  const isDark = useThemeStore(s => s.isDark)
  return getColors(isDark)
}
