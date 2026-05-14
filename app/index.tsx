import { Redirect } from 'expo-router'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Config } from '@/constants/config'

export default function Index() {
  const { role } = useAuthStore()

  if (Config.useMock) {
    if (role === 'operator') return <Redirect href="/(operator)/dashboard" />
    if (role === 'host') return <Redirect href="/(host)/listings" />
    return <Redirect href="/(consumer)/explore" />
  }

  if (role === 'operator') {
    return <Redirect href="/(operator)/dashboard" />
  }

  if (role === 'host') {
    return <Redirect href="/(host)/listings" />
  }

  return <Redirect href="/(consumer)/explore" />
}
