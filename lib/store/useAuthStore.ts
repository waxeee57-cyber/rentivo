import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { RentivoUser, Operator, Host, UserRole } from '@/types'
import { supabase } from '@/lib/supabase'

interface AuthState {
  role: UserRole
  /** Alias for `role` — the currently active dashboard role */
  currentRole: UserRole
  user: RentivoUser | null
  operator: Operator | null
  host: Host | null
  session: Record<string, unknown> | null
  loading: boolean
  language: 'en' | 'es' | 'hu'
  /** True when the signed-in user has an operator account record */
  hasOperatorAccount: boolean
  /** True when the signed-in user has a host account record */
  hasHostAccount: boolean
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
      currentRole: null,
      user: null,
      operator: null,
      host: null,
      session: null,
      loading: false,
      language: 'en',
      hasOperatorAccount: false,
      hasHostAccount: false,
      setRole: (role) => set({ role, currentRole: role }),
      setUser: (user) => set({ user }),
      setOperator: (operator) => set({ operator, hasOperatorAccount: operator !== null }),
      setHost: (host) => set({ host, hasHostAccount: host !== null }),
      setSession: (session) => set({ session }),
      setLoading: (loading) => set({ loading }),
      setLanguage: (language) => set({ language }),
      signOut: async () => {
        await supabase.auth.signOut()
        set({
          role: null,
          currentRole: null,
          user: null,
          operator: null,
          host: null,
          session: null,
          hasOperatorAccount: false,
          hasHostAccount: false,
        })
        // Clear the persisted Zustand snapshot so stale state cannot
        // conflict with a subsequent fresh login.
        try {
          await AsyncStorage.removeItem('rentivo-auth')
        } catch {
          // Silently ignore — worst case the persist rehydration wins on
          // next boot, but the Supabase session will already be gone.
        }
      },
    }),
    {
      name: 'rentivo-auth',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
)
