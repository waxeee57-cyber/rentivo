import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Colors, Spacing } from '@/constants/colors'
import { EmptyState } from '@/components/ui/EmptyState'

export default function OperatorDamageScreen() {
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
  },
  back: { fontSize: 16, color: Colors.primary, fontWeight: '600', width: 50 },
  header: { fontSize: 18, fontWeight: '700', color: Colors.text },
})
