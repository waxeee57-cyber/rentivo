import React, { useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Colors, Spacing } from '@/constants/colors'
import { EmptyState } from '@/components/ui/EmptyState'
import { useColors } from '@/lib/hooks/useColors'

export default function OperatorDamageScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>()

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.header}>Damage Report</Text>
        <View style={{ width: 50 }} />
      </View>
      <EmptyState
        emoji="📋"
        title="Damage Report"
        subtitle={`Booking: ${bookingId}\nDamage reports appear here after inspections are completed.`}
      />
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
  },
  back: { fontSize: 16, color: C.primary, fontWeight: '600', width: 50 },
  header: { fontSize: 18, fontWeight: '700', color: C.text },
  })
}
