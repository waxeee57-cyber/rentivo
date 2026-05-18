import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Spacing, Radius, Typography, Shadow } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'

type Variant = 'solid' | 'transparent' | 'large'

interface ScreenHeaderProps {
  title: string
  subtitle?: string
  rightAction?: React.ReactNode
  onBack?: () => void
  transparent?: boolean
  variant?: Variant
  showBack?: boolean
}

export function ScreenHeader({
  title,
  subtitle,
  rightAction,
  onBack,
  transparent = false,
  variant,
  showBack = true,
}: ScreenHeaderProps) {
  const C = useColors()
  const insets = useSafeAreaInsets()
  const resolvedVariant: Variant = variant ?? (transparent ? 'transparent' : 'solid')

  if (resolvedVariant === 'transparent') {
    return (
      <View style={[styles.transparentContainer, { top: 0, left: 0, right: 0, paddingTop: insets.top + 8 }]}>
        {showBack && (
          <TouchableOpacity
            onPress={onBack ?? (() => router.back())}
            style={styles.circleBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }} />
        {rightAction && <View style={styles.rightSlot}>{rightAction}</View>}
      </View>
    )
  }

  if (resolvedVariant === 'large') {
    return (
      <View style={[styles.largeContainer, { paddingTop: insets.top + 8, backgroundColor: C.background }]}>
        <Text style={[styles.largeTitle, { color: C.text }]}>{title}</Text>
        {subtitle && <Text style={[styles.largeSubtitle, { color: C.textSecondary }]}>{subtitle}</Text>}
        {rightAction && <View style={styles.largeRightSlot}>{rightAction}</View>}
      </View>
    )
  }

  // Solid (default)
  return (
    <View style={[
      styles.solidContainer,
      {
        paddingTop: insets.top + 8,
        backgroundColor: C.background,
        borderBottomColor: C.border,
      },
    ]}>
      {showBack ? (
        <TouchableOpacity
          onPress={onBack ?? (() => router.back())}
          style={[styles.surfaceCircleBtn, { backgroundColor: C.surface, borderColor: C.border }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
      ) : (
        <View style={styles.placeholder} />
      )}

      <View style={styles.titleContainer}>
        <Text style={[styles.solidTitle, { color: C.text }]} numberOfLines={1}>{title}</Text>
        {subtitle && <Text style={[styles.solidSubtitle, { color: C.textSecondary }]} numberOfLines={1}>{subtitle}</Text>}
      </View>

      <View style={styles.rightSlot}>
        {rightAction}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  solidContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
  },

  transparentContainer: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
    zIndex: 10,
  },

  largeContainer: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.base,
  },

  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },

  surfaceCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  placeholder: {
    width: 40,
  },

  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },

  solidTitle: {
    ...Typography.h4,
  },

  solidSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },

  largeTitle: {
    ...Typography.h1,
    marginBottom: 4,
  },

  largeSubtitle: {
    ...Typography.body,
  },

  rightSlot: {
    width: 44,
    alignItems: 'flex-end',
  },

  largeRightSlot: {
    position: 'absolute',
    right: Spacing.base,
    top: 0,
  },
})
