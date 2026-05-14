import { create } from 'zustand'

interface NotificationStore {
  unreadCount: number
  pushToken: string | null
  operatorUnreadCount: number
  setUnreadCount: (count: number) => void
  setPushToken: (token: string | null) => void
  decrementUnread: () => void
  setOperatorUnreadCount: (count: number) => void
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  unreadCount: 0,
  pushToken: null,
  operatorUnreadCount: 0,
  setUnreadCount: (count) => set({ unreadCount: count }),
  setPushToken: (token) => set({ pushToken: token }),
  decrementUnread: () => set({ unreadCount: Math.max(0, get().unreadCount - 1) }),
  setOperatorUnreadCount: (count) => set({ operatorUnreadCount: count }),
}))
