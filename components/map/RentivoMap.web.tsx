import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors, Spacing } from '@/constants/colors'

export default function RentivoMap() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Map view is not available on web</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceWarm },
  text: { color: Colors.textSecondary, fontSize: 14 },
})
