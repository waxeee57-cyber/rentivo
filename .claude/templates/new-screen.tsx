// Template: új consumer/operator/host screen
import React, { useState, useEffect } from 'react'
import { View, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Colors, Spacing } from '@/constants/colors'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { t } from '@/constants/i18n'

export default function NewScreen() {
  const { language } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<unknown[]>([])

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    try {
      setLoading(true)
      // fetch data
      setLoading(false)
    } catch {
      setError('Failed to load')
      setLoading(false)
    }
  }

  if (loading) return <LoadingOverlay />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Title" />
      <ScrollView contentContainerStyle={styles.content}>
        {data.length === 0 ? (
          <EmptyState
            emoji="🔍"
            title="Nothing here yet"
            subtitle="Check back later"
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base },
})
