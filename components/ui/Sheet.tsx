import React, { useEffect, useRef, useMemo } from 'react'
import {
  Modal, View, TouchableOpacity, Text,
  Animated, StyleSheet, ScrollView, ViewStyle,
} from 'react-native'
import { Colors, Radius, Spacing } from '@/constants/colors'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '@/lib/hooks/useColors'

interface SheetProps {
  visible: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  snapHeight?: number | 'auto'
  style?: ViewStyle
}

export function Sheet({ visible, onClose, title, children, snapHeight, style }: SheetProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const insets = useSafeAreaInsets()
  const slideAnim = useRef(new Animated.Value(300)).current

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 300,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start()
  }, [visible, slideAnim])

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View
        style={[
          styles.sheet,
          { transform: [{ translateY: slideAnim }], paddingBottom: insets.bottom + Spacing.base },
          snapHeight ? { height: snapHeight } : {},
          style,
        ]}
      >
        <View style={styles.handle} />
        {title && <Text style={styles.title}>{title}</Text>}
        <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
      </Animated.View>
    </Modal>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.overlay,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.surface,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: 'center',
    marginBottom: Spacing.base,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
    marginBottom: Spacing.base,
    textAlign: 'center',
  },
  })
}
