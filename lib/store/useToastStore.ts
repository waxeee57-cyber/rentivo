import { create } from 'zustand'

export interface ToastConfig {
  message: string
  type: 'success' | 'error' | 'info'
  duration?: number
}

interface ToastStore {
  toast: ToastConfig | null
  showToast: (config: ToastConfig) => void
  hideToast: () => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toast: null,
  showToast: (config) => {
    set({ toast: config })
    setTimeout(() => set({ toast: null }), config.duration ?? 3000)
  },
  hideToast: () => set({ toast: null }),
}))
