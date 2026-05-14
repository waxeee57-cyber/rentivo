import { Redirect } from 'expo-router'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Config } from '@/constants/config'

export default function Index() {
  const { role } = useAuthStore()

  if (Config.useMock) {
    return <Redirect href="/(consumer)/explore" />
  }

  if (role === 'operator') {
    return <Redirect href="/(operator)/dashboard" />
  }

  return <Redirect href="/(consumer)/explore" />
}
