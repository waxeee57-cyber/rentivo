import React, { useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Spacing } from '@/constants/colors'
import { EmptyState } from '@/components/ui/EmptyState'
import { useColors } from '@/lib/hooks/useColors'
import { t } from '@/constants/i18n'
import { useAuthStore } from '@/lib/store/useAuthStore'

export default function OperatorDamageScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>()
  const { language } = useAuthStore()

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityLabel={t('opBkBack', language)}
          accessibilityRole="button"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.back}>{`← ${t('opBkBack', language)}`}</Text>
        </TouchableOpacity>
        <Text style={styles.header}>{t('opBkDamageReport', language)}</Text>
        <View style={{ width: 50 }} />
      </View>
      <EmptyState
        emoji="📋"
        title={t('opBkDamageReport', language)}
        subtitle={`Booking: ${bookingId ?? ''}\n${t('opBkDamageEmpty', language)}`}
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
