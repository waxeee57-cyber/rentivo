import React, { useEffect } from 'react'
import { Text, StyleSheet, TouchableOpacity } from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withTiming,
  cancelAnimation,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors, Radius, Spacing } from '@/constants/colors'
import { useToastStore } from '@/lib/store/useToastStore'

export function Toast() {
  const { toast, hideToast } = useToastStore()
  const translateY = useSharedValue(-120)
  const opacity = useSharedValue(0)
  const insets = useSafeAreaInsets()

  useEffect(() => {
    if (toast) {
      cancelAnimation(translateY)
      cancelAnimation(opacity)
      translateY.value = withSpring(0, { damping: 16, stiffness: 260 })
      opacity.value = withTiming(1, { duration: 180 })

      const timer = setTimeout(() => {
        translateY.value = withTiming(-120, { duration: 220 })
        opacity.value = withTiming(0, { duration: 180 })
        setTimeout(hideToast, 230)
      }, 3000)

      return () => clearTimeout(timer)
    } else {
      translateY.value = withTiming(-120, { duration: 200 })
      opacity.value = withTiming(0, { duration: 180 })
    }
  }, [toast])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }))

  if (!toast) return null

  const config = toast.type === 'success'
    ? { bg: Colors.successSurface, border: Colors.success, icon: '✓', iconColor: Colors.success }
    : toast.type === 'error'
    ? { bg: Colors.errorSurface, border: Colors.error, icon: '✕', iconColor: Colors.error }
    : { bg: Colors.primarySubtle, border: Colors.primary, icon: 'ℹ', iconColor: Colors.primary }

  return (
    <Animated.View style={[
      styles.container,
      {
        top: insets.top + 16,
        backgroundColor: config.bg,
        borderColor: config.border,
      },
      animatedStyle,
    ]}>
      <TouchableOpacity style={styles.inner} onPress={hideToast} activeOpacity={0.9}>
        <Text style={[styles.icon, { color: config.iconColor }]}>{config.icon}</Text>
        <Text style={styles.message} numberOfLines={2}>{toast.message}</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.base,
    right: Spacing.base,
    borderRadius: Radius.lg,
    borderWidth: 1,
    zIndex: 9999,
    minHeight: 52,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 12,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
  },
  icon: {
    fontSize: 16,
    fontWeight: '800',
    width: 22,
    textAlign: 'center',
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 20,
  },
})
