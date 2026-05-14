import React, { useEffect, useRef } from 'react'
import { Animated, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { useToastStore } from '@/lib/store/useToastStore'

export function Toast() {
  const { toast, hideToast } = useToastStore()
  const anim = useRef(new Animated.Value(-100)).current
  const insets = useSafeAreaInsets()

  useEffect(() => {
    if (toast) {
      Animated.spring(anim, {
        toValue: insets.top + 8,
        useNativeDriver: false,
        damping: 18,
        stiffness: 250,
      }).start()
    } else {
      Animated.timing(anim, {
        toValue: -100,
        duration: 250,
        useNativeDriver: false,
      }).start()
    }
  }, [toast, insets.top])

  if (!toast) return null

  const bgColor =
    toast.type === 'success' ? Colors.success :
    toast.type === 'error'   ? Colors.error :
    Colors.primary

  const icon =
    toast.type === 'success' ? '✓' :
    toast.type === 'error'   ? '✕' :
    'ℹ'

  return (
    <Animated.View style={[styles.container, { top: anim, backgroundColor: bgColor }]}>
      <TouchableOpacity style={styles.inner} onPress={hideToast} activeOpacity={0.9}>
        <Text style={styles.icon}>{icon}</Text>
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
    borderRadius: Radius.xl,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
  },
  icon: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    width: 22,
    textAlign: 'center',
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 20,
  },
})
