import React, { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { Radius, Spacing, Fonts } from '@/constants/colors'
import { useCamera } from '@/lib/hooks/useCamera'
import { useColors } from '@/lib/hooks/useColors'

interface PhotoCaptureProps {
  label: string
  uri: string | null
  onCapture: (uri: string) => void
}

export function PhotoCapture({ label, uri, onCapture }: PhotoCaptureProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
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
    <TouchableOpacity
      style={[styles.slot, uri && styles.slotFilled]}
      onPress={handlePress}
      activeOpacity={0.8}
      disabled={loading}
    >
      {uri ? (
        <>
          <Image source={{ uri }} style={styles.image} contentFit="cover" />
          {/* Green checkmark overlay */}
          <View style={styles.checkOverlay}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
          {/* Retake hint */}
          <View style={styles.retakeOverlay}>
            <Text style={styles.retakeText}>Retake</Text>
          </View>
        </>
      ) : (
        <View style={styles.placeholder}>
          <Ionicons
            name="camera-outline"
            size={28}
            color={C.textTertiary}
            style={styles.cameraIcon}
            importantForAccessibility="no"
          />
          <Text style={styles.label}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  slot: {
    width: '47%',
    aspectRatio: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: C.borderWarm,
    backgroundColor: C.surfaceWarm,
    marginBottom: Spacing.md,
  },
  slotFilled: {
    borderStyle: 'solid',
    borderColor: C.success,
  },
  image: { width: '100%', height: '100%' },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  cameraIcon: { marginBottom: 6 },
  label: { fontSize: 12, color: C.textTertiary, textAlign: 'center', fontFamily: Fonts.semibold },
  checkOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: { fontSize: 12, color: C.white, fontFamily: Fonts.extrabold },
  retakeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.overlayLight,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 6,
    opacity: 0,
  },
  retakeText: { fontSize: 11, color: C.white, fontFamily: Fonts.bold },
  })
}
