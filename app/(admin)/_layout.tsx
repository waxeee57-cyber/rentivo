import { Stack } from 'expo-router'
import { useEffect } from 'react'
import { router } from 'expo-router'
import { useAuthStore } from '@/lib/store/useAuthStore'

export default function AdminLayout() {
  const { user } = useAuthStore()

  useEffect(() => {
    if (!user?.is_admin) {
      router.replace('/(consumer)/explore')
    }
  }, [user])

  return <Stack screenOptions={{ headerShown: false }} />
}
