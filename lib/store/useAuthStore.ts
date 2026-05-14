import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { RentivoUser, Operator, Host, UserRole } from '@/types'
import { supabase } from '@/lib/supabase'

interface AuthState {
  role: UserRole
  user: RentivoUser | null
  operator: Operator | null
  host: Host | null
  session: Record<string, unknown> | null
  loading: boolean
  language: 'en' | 'es' | 'hu'
  setRole: (role: UserRole) => void
  setUser: (user: RentivoUser | null) => void
  setOperator: (operator: Operator | null) => void
  setHost: (host: Host | null) => void
  setSession: (session: Record<string, unknown> | null) => void
  setLoading: (loading: boolean) => void
  setLanguage: (lang: 'en' | 'es' | 'hu') => void
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      role: null,
      user: null,
      operator: null,
      host: null,
      session: null,
      loading: false,
      language: 'en',
      setRole: (role) => set({ role }),
      setUser: (user) => set({ user }),
      setOperator: (operator) => set({ operator }),
      setHost: (host) => set({ host }),
      setSession: (session) => set({ session }),
      setLoading: (loading) => set({ loading }),
      setLanguage: (language) => set({ language }),
      signOut: async () => {
        await supabase.auth.signOut()
        set({ role: null, user: null, operator: null, host: null, session: null })
      },
    }),
    {
      name: 'rentivo-auth',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
)
