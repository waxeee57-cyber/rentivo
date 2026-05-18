import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { Colors, Radius } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'

interface AvatarProps {
  name?: string | null
  imageUrl?: string | null
  size?: number
}

export function Avatar({ name, imageUrl, size = 40 }: AvatarProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const initials = name
    ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
      />
    )
  }

  return (
    <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.initials, { fontSize: size * 0.35 }]}>{initials}</Text>
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  placeholder: {
    backgroundColor: C.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: C.primaryDark, fontWeight: '700' },
  })
}
