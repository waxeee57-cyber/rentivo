import React, { useEffect, useRef } from 'react'
import { Animated, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors, Radius, Spacing } from '@/constants/colors'
import { useToastStore } from '@/lib/store/useToastStore'

const { width } = Dimensions.get('window')

export function Toast() {
  const { toast, hideToast } = useToastStore()
  const translateY = useRef(new Animated.Value(-120)).current
  const opacity = useRef(new Animated.Value(0)).current
  const insets = useSafeAreaInsets()

  useEffect(() => {
    if (toast) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: insets.top + 16,
          damping: 20,
          stiffness: 300,
          useNativeDriver: false,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start()

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -120,
            duration: 200,
            useNativeDriver: false,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false,
          }),
        ]).start(() => hideToast())
      }, 3000)

      return () => clearTimeout(timer)
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -120, duration: 200, useNativeDriver: false }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: false }),
      ]).start()
    }
  }, [toast, insets.top])

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
        top: translateY,
        opacity,
        backgroundColor: config.bg,
        borderColor: config.border,
      },
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
