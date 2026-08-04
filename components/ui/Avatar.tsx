import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { Radius, Fonts } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'
import {
  IMAGE_PLACEHOLDER, IMAGE_TRANSITION, IMAGE_CACHE_POLICY,
} from '@/components/ui/imagePlaceholder'

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
        transition={IMAGE_TRANSITION}
        placeholder={IMAGE_PLACEHOLDER}
        cachePolicy={IMAGE_CACHE_POLICY}
        // Avatars are the classic recycling casualty: in a list of hosts the
        // previous row's face flashes in the next row's circle without this.
        recyclingKey={imageUrl}
        accessible
        accessibilityLabel={name ? `${name}'s profile photo` : 'Profile photo'}
      />
    )
  }

  return (
    <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.initials, { fontFamily: Fonts.regular, fontSize: size * 0.35 }]}>{initials}</Text>
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  // An avatar is an identity chip, not an action — the brand accent is reserved
  // for the primary CTA and the active tab. Neutral ink pair instead:
  // C.text on C.surfaceWarm (15.0:1 light, 13.1:1 dark).
  placeholder: {
    backgroundColor: C.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: C.text, fontFamily: Fonts.bold },
  })
}
