import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors, Spacing } from '@/constants/colors'

interface ScreenHeaderProps {
  title: string
  subtitle?: string
  rightAction?: React.ReactNode
  onBack?: () => void
  transparent?: boolean
}

export function ScreenHeader({
  title,
  subtitle,
  rightAction,
  onBack,
  transparent = false,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[
      styles.container,
      { paddingTop: insets.top + 8 },
      transparent && styles.transparent,
    ]}>
      <TouchableOpacity
        onPress={onBack ?? (() => router.back())}
        style={styles.backButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons
          name="chevron-back"
          size={24}
          color={transparent ? Colors.surface : Colors.text}
        />
      </TouchableOpacity>

      <View style={styles.titleContainer}>
        <Text style={[styles.title, transparent && { color: Colors.surface }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        )}
      </View>

      <View style={styles.rightAction}>
        {rightAction}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  transparent: {
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  rightAction: {
    width: 44,
    alignItems: 'flex-end',
  },
})
