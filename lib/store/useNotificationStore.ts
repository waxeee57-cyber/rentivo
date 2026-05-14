import { create } from 'zustand'

interface NotificationStore {
  unreadCount: number
  pushToken: string | null
  setUnreadCount: (count: number) => void
  setPushToken: (token: string | null) => void
  decrementUnread: () => void
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  unreadCount: 0,
  pushToken: null,
  setUnreadCount: (count) => set({ unreadCount: count }),
  setPushToken: (token) => set({ pushToken: token }),
  decrementUnread: () => set({ unreadCount: Math.max(0, get().unreadCount - 1) }),
}))
