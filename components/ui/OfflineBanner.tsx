import React, { useState, useEffect, useRef, useMemo } from 'react'
import { View, Text, StyleSheet, AppState, AppStateStatus } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Spacing, Fonts } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'

function checkConnection(setOnline: (v: boolean) => void) {
  fetch('https://captive.apple.com/hotspot-detect.html', {
    method: 'HEAD',
    cache: 'no-store',
  })
    .then(() => setOnline(true))
    .catch(() => setOnline(false))
}

export function OfflineBanner() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const [isOnline, setIsOnline] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const appState = useRef(AppState.currentState)

  useEffect(() => {
    checkConnection(setIsOnline)
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') checkConnection(setIsOnline)
      appState.current = nextState
    })
    return () => sub.remove()
  }, [])

  if (isOnline || dismissed) return null

  return (
    <View style={styles.banner}>
      <Ionicons
        name="cloud-offline-outline"
        size={16}
        color={C.text}
        style={styles.icon}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text style={styles.text}>No internet · Some features unavailable</Text>
      <Text style={styles.dismiss} onPress={() => setDismissed(true)}>✕</Text>
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  banner: {
    backgroundColor: C.warningSurface,
    borderBottomWidth: 1,
    borderBottomColor: C.warning,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  icon: { marginRight: Spacing.sm },
  text: { fontSize: 13, fontFamily: Fonts.semibold, color: C.text, flex: 1 },
  dismiss: { fontSize: 16, color: C.textSecondary, fontFamily: Fonts.bold, paddingLeft: Spacing.sm },
  })
}
