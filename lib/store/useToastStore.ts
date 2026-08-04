import { create } from 'zustand'
import {
  notificationAsync, impactAsync,
  NotificationFeedbackType, ImpactFeedbackStyle,
} from 'expo-haptics'

export interface ToastConfig {
  message: string
  // 'warning' is additive — Toast renders it via the neutral/info branch until
  // it grows a dedicated style, but it already gets its own haptic signature.
  type: 'success' | 'error' | 'warning' | 'info'
  duration?: number
}

interface ToastStore {
  toast: ToastConfig | null
  showToast: (config: ToastConfig) => void
  hideToast: () => void
}

/**
 * Haptics live HERE, not at the ~60 showToast call sites.
 *
 * Before this, only 3 of those call sites bothered to fire a haptic, so the
 * same failure felt different depending on which screen you were on. Keying
 * the feedback off `config.type` in the store makes it uniform for free and
 * removes the temptation to hand-roll it again.
 *
 * Every call is fire-and-forget with a swallowed rejection: platforms with no
 * haptic engine (web, some Android devices, simulators) reject the promise,
 * and a missing taptic must never surface as an unhandled rejection or block
 * the toast from showing.
 */
function fireToastHaptic(type: ToastConfig['type']): void {
  try {
    switch (type) {
      case 'success':
        notificationAsync(NotificationFeedbackType.Success).catch(() => {})
        break
      case 'error':
        notificationAsync(NotificationFeedbackType.Error).catch(() => {})
        break
      case 'warning':
        notificationAsync(NotificationFeedbackType.Warning).catch(() => {})
        break
      case 'info':
        // Info is not an outcome — a soft tap, not a notification pattern.
        impactAsync(ImpactFeedbackStyle.Light).catch(() => {})
        break
    }
  } catch {
    // Some platforms throw synchronously instead of rejecting.
  }
}

export const useToastStore = create<ToastStore>((set) => ({
  toast: null,
  showToast: (config) => {
    fireToastHaptic(config.type)
    set({ toast: config })
    setTimeout(() => set({ toast: null }), config.duration ?? 3000)
  },
  hideToast: () => set({ toast: null }),
}))
