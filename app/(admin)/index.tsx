import React from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { Card } from '@/components/ui/Card'

interface StatItem {
  label: string
  value: string
}

interface SectionItem {
  title: string
  route: string
}

const stats: StatItem[] = [
  { label: 'Users', value: '1,247' },
  { label: 'Operators', value: '89' },
  { label: 'Active Bookings', value: '34' },
  { label: 'Revenue (EUR)', value: '€48,200' },
]

const sections: SectionItem[] = [
  { title: 'Operators', route: '/(admin)/operators' },
  { title: 'Users', route: '/(admin)/users' },
  { title: 'Promo Codes', route: '/(admin)/promo-codes' },
]

export default function AdminDashboard() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Admin Panel</Text>
        <View style={styles.statsGrid}>
          {stats.map((s) => (
            <Card key={s.label} style={styles.statCard}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </Card>
          ))}
        </View>
        {sections.map((s) => (
          <TouchableOpacity
            key={s.title}
            style={styles.navCard}
            onPress={() => router.push(s.route as Parameters<typeof router.push>[0])}
            accessibilityLabel={s.title}
            accessibilityRole="button"
          >
            <Text style={styles.navTitle}>{s.title}</Text>
            <Text style={styles.chevron}>{'›'}</Text>
          </TouchableOpacity>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    padding: Spacing.base,
    paddingBottom: Spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  statCard: {
    width: '47%',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  navCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    minHeight: 56,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  navTitle: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '600',
  },
  chevron: {
    fontSize: 22,
    color: Colors.textTertiary,
  },
})
