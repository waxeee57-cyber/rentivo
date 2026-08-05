import React, { useEffect, useMemo, useCallback } from 'react'
import {
  Modal, View, TouchableOpacity, Text,
  StyleSheet, ScrollView, ViewStyle,
} from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS,
} from 'react-native-reanimated'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics'
import { Radius, Spacing, Fonts } from '@/constants/colors'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '@/lib/hooks/useColors'

// Distance the sheet travels when closed. Kept at the historical 300 so the
// open/close motion is unchanged for sheets shorter than that.
const CLOSED_OFFSET = 300

// Ink-first settle: damping 22 against stiffness 260 is over-damped, so the
// sheet glides to rest in ~240ms with no rubber-band overshoot at the top.
const SHEET_SPRING = { damping: 22, stiffness: 260 } as const

// Drag past 30% of the sheet's own height, or flick faster than 800px/s, and
// letting go dismisses. Two thresholds because a slow full drag and a fast
// short flick are both "I want this gone".
const DISMISS_RATIO = 0.3
const DISMISS_VELOCITY = 800

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

  const translateY = useSharedValue(CLOSED_OFFSET)
  // Measured at layout so the dismiss threshold is relative to THIS sheet,
  // not a hardcoded guess — a 200px confirm sheet and a 90%-tall filter sheet
  // should not need the same drag distance.
  const sheetHeight = useSharedValue(CLOSED_OFFSET)
  const pastThreshold = useSharedValue(false)

  useEffect(() => {
    translateY.value = withSpring(visible ? 0 : CLOSED_OFFSET, SHEET_SPRING)
  }, [visible, translateY])

  const fireDismissHaptic = useCallback(() => {
    // Swallow: no haptic engine must never break the drag.
    impactAsync(ImpactFeedbackStyle.Light).catch(() => {})
  }, [])

  // The gesture is attached to the handle/title strip only — NOT the whole
  // sheet. The body is a ScrollView, and a sheet-wide pan would fight it for
  // every vertical swipe.
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onUpdate(e => {
          'worklet'
          // Clamp at 0: dragging upward must not peel the sheet off the
          // bottom edge and expose the backdrop underneath it.
          translateY.value = Math.max(0, e.translationY)
          const crossed = translateY.value > sheetHeight.value * DISMISS_RATIO
          if (crossed !== pastThreshold.value) {
            pastThreshold.value = crossed
            // Only on the way in — a tick that says "release now and it closes".
            if (crossed) runOnJS(fireDismissHaptic)()
          }
        })
        .onEnd(e => {
          'worklet'
          pastThreshold.value = false
          const shouldClose =
            e.translationY > sheetHeight.value * DISMISS_RATIO || e.velocityY > DISMISS_VELOCITY
          if (shouldClose) {
            translateY.value = withTiming(sheetHeight.value, { duration: 180 })
            runOnJS(onClose)()
          } else {
            translateY.value = withSpring(0, SHEET_SPRING)
          }
        }),
    [onClose, fireDismissHaptic, translateY, sheetHeight, pastThreshold],
  )

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      {/* On Android a Modal renders into its own native view hierarchy, so the
          app-root GestureHandlerRootView cannot see gestures in here. Without
          this wrapper the pan silently does nothing on Android. */}
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={title ? `Close ${title}` : 'Close'}
        />
        <Animated.View
          onLayout={e => { sheetHeight.value = e.nativeEvent.layout.height }}
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + Spacing.base },
            snapHeight ? { height: snapHeight } : {},
            style,
            // Last so a caller-supplied `style` can never clobber the transform.
            sheetStyle,
          ]}
        >
          <GestureDetector gesture={panGesture}>
            <View style={styles.dragZone}>
              <View style={styles.handle} importantForAccessibility="no" />
              {title && <Text style={styles.title}>{title}</Text>}
            </View>
          </GestureDetector>
          <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
        </Animated.View>
      </GestureHandlerRootView>
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
  // Negative margin + equal padding: the grab area reaches up to the sheet's
  // very top edge (a 4px handle is not a thumb target) while every child
  // stays at exactly the pixel it sat at before.
  dragZone: {
    marginTop: -Spacing.md,
    paddingTop: Spacing.md,
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
    fontFamily: Fonts.bold,
    color: C.text,
    marginBottom: Spacing.base,
    textAlign: 'center',
  },
  })
}
