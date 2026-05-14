import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors, Spacing, Radius, Typography, Shadow } from '@/constants/colors'

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
            <Ionicons name="chevron-back" size={22} color={Colors.text} />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }} />
        {rightAction && <View style={styles.rightSlot}>{rightAction}</View>}
      </View>
    )
  }

  if (resolvedVariant === 'large') {
    return (
      <View style={[styles.largeContainer, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.largeTitle}>{title}</Text>
        {subtitle && <Text style={styles.largeSubtitle}>{subtitle}</Text>}
        {rightAction && <View style={styles.largeRightSlot}>{rightAction}</View>}
      </View>
    )
  }

  // Solid (default)
  return (
    <View style={[styles.solidContainer, { paddingTop: insets.top + 8 }]}>
      {showBack ? (
        <TouchableOpacity
          onPress={onBack ?? (() => router.back())}
          style={styles.surfaceCircleBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>
      ) : (
        <View style={styles.placeholder} />
      )}

      <View style={styles.titleContainer}>
        <Text style={styles.solidTitle} numberOfLines={1}>{title}</Text>
        {subtitle && <Text style={styles.solidSubtitle} numberOfLines={1}>{subtitle}</Text>}
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
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
    backgroundColor: Colors.background,
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
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
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
    color: Colors.text,
  },

  solidSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },

  largeTitle: {
    ...Typography.h1,
    color: Colors.text,
    marginBottom: 4,
  },

  largeSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
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
