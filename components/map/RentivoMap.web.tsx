import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors, Spacing } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'

export default function RentivoMap() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Map view is not available on web</Text>
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surfaceWarm },
  text: { color: C.textSecondary, fontSize: 14 },
  })
}
