import { Redirect } from 'expo-router'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Config } from '@/constants/config'

export default function Index() {
  const { session, role } = useAuthStore()

  if (Config.useMock) {
    if (role === 'operator') return <Redirect href="/(operator)/dashboard" />
    return <Redirect href="/(consumer)/explore" />
  }

  if (!session) return <Redirect href="/auth" />
  if (role === 'operator') return <Redirect href="/(operator)/dashboard" />
  return <Redirect href="/(consumer)/explore" />
}
