import React, { useState, useMemo } from 'react'
import { View, Text, TextInput, StyleSheet, TextInputProps, ViewStyle } from 'react-native'
import { Radius, Spacing, Fonts } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'

interface InputProps extends TextInputProps {
  label?: string
  error?: string
  containerStyle?: ViewStyle
}

export function Input({ label, error, containerStyle, style, ...props }: InputProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const [focused, setFocused] = useState(false)
  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          focused && styles.inputFocused,
          error && styles.inputError,
          style,
        ]}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor={C.textTertiary}
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { marginBottom: Spacing.base },
  label: {
    fontSize: 13,
    fontFamily: Fonts.semibold,
    color: C.textSecondary,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    // minHeight, not height: at large system font sizes a fixed 48px box clips
    // the text. Nothing in the app disables allowFontScaling, so the field must
    // be free to grow with the user's text-size setting.
    minHeight: 48,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.base,
    fontFamily: Fonts.regular, fontSize: 15,
    color: C.text,
    backgroundColor: C.surfaceWarm,
  },
  inputFocused: { borderColor: C.primary },
  inputError: { borderColor: C.error },
  error: { fontFamily: Fonts.regular, fontSize: 12, color: C.error, marginTop: Spacing.xs },
  })
}
