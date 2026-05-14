import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { Image } from 'expo-image'
import { Colors, Radius, Spacing } from '@/constants/colors'
import { useCamera } from '@/lib/hooks/useCamera'

interface PhotoCaptureProps {
  label: string
  uri: string | null
  onCapture: (uri: string) => void
}

export function PhotoCapture({ label, uri, onCapture }: PhotoCaptureProps) {
  const { takePicture, pickFromGallery, loading } = useCamera()

  const handlePress = () => {
    Alert.alert(
      'Add Photo',
      `Capture ${label}`,
      [
        { text: 'Camera', onPress: async () => { const u = await takePicture(); if (u) onCapture(u) } },
        { text: 'Gallery', onPress: async () => { const u = await pickFromGallery(); if (u) onCapture(u) } },
        { text: 'Cancel', style: 'cancel' },
      ],
    )
  }

  return (
    <TouchableOpacity style={styles.slot} onPress={handlePress} activeOpacity={0.8} disabled={loading}>
      {uri ? (
        <Image source={{ uri }} style={styles.image} contentFit="cover" />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.icon}>📷</Text>
          <Text style={styles.label}>{label}</Text>
        </View>
      )}
      {uri && (
        <View style={styles.retakeOverlay}>
          <Text style={styles.retakeText}>Retake</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  slot: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    backgroundColor: Colors.surfaceWarm,
    marginBottom: Spacing.sm,
  },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 4 },
  icon: { fontSize: 22, marginBottom: 4 },
  label: { fontSize: 10, color: Colors.textSecondary, textAlign: 'center', fontWeight: '600' },
  retakeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlayLight,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  retakeText: { fontSize: 10, color: Colors.textInverse, fontWeight: '700' },
})
