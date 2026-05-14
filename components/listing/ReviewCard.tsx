import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors, Radius, Spacing } from '@/constants/colors'
import { Avatar } from '@/components/ui/Avatar'
import { formatDate } from '@/lib/utils/formatDate'
import type { Review } from '@/types'

interface ReviewCardProps {
  review: Review
  userName?: string
}

export function ReviewCard({ review, userName }: ReviewCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Avatar name={userName ?? 'Traveler'} size={36} />
        <View style={{ flex: 1, marginLeft: Spacing.sm }}>
          <Text style={styles.name}>{userName ?? 'Anonymous'}</Text>
          <Text style={styles.date}>{formatDate(review.created_at)}</Text>
        </View>
        <Text style={styles.stars}>{'★'.repeat(review.rating)}</Text>
      </View>
      {review.comment && <Text style={styles.comment}>{review.comment}</Text>}
      {review.reply && (
        <View style={styles.replyBox}>
          <Text style={styles.replyLabel}>Operator reply:</Text>
          <Text style={styles.reply}>{review.reply}</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  name: { fontSize: 14, fontWeight: '600', color: Colors.text },
  date: { fontSize: 12, color: Colors.textTertiary },
  stars: { color: Colors.primary, fontSize: 14 },
  comment: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  replyBox: {
    backgroundColor: Colors.surfaceWarm,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  replyLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 2 },
  reply: { fontSize: 13, color: Colors.textSecondary },
})
