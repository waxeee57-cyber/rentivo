import React, { useEffect, useRef } from 'react'
import { Text, StyleSheet, Animated, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Radius, Spacing } from '@/constants/colors'
import { useToastStore } from '@/lib/store/useToastStore'
import { useColors } from '@/lib/hooks/useColors'

export function Toast() {
  const C = useColors()
  const { toast, hideToast } = useToastStore()
  const translateY = useRef(new Animated.Value(-120)).current
  const opacity = useRef(new Animated.Value(0)).current
  const insets = useSafeAreaInsets()

  useEffect(() => {
    if (toast) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, damping: 16, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start()

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: -120, duration: 220, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        ]).start(() => hideToast())
      }, 3000)

      return () => clearTimeout(timer)
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -120, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start()
    }
  }, [toast])

  if (!toast) return null

  const config = toast.type === 'success'
    ? { bg: C.successSurface, border: C.success, icon: '✓', iconColor: C.success }
    : toast.type === 'error'
    ? { bg: C.errorSurface, border: C.error, icon: '✕', iconColor: C.error }
    : { bg: C.primarySubtle, border: C.primary, icon: 'ℹ', iconColor: C.primary }

  return (
    <Animated.View style={[
      styles.container,
      {
        top: insets.top + 16,
        backgroundColor: config.bg,
        borderColor: config.border,
        transform: [{ translateY }],
        opacity,
      },
    ]}>
      <TouchableOpacity style={styles.inner} onPress={hideToast} activeOpacity={0.9}>
        <Text style={[styles.icon, { color: config.iconColor }]}>{config.icon}</Text>
        <Text style={[styles.message, { color: C.text }]} numberOfLines={2}>{toast.message}</Text>
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
    lineHeight: 20,
  },
})
