import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { getColors, Spacing, Radius, Typography } from '@/constants/colors'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useThemeStore } from '@/lib/store/useThemeStore'
import { captureException } from '@/lib/sentry'

type Lang = 'en' | 'es' | 'hu'

const COPY: Record<Lang, { title: string; body: string; retry: string }> = {
  en: {
    title: 'Something went wrong',
    body: 'The app ran into an unexpected problem. You can try again.',
    retry: 'Try again',
  },
  hu: {
    title: 'Hiba történt',
    body: 'Az alkalmazás váratlan hibába ütközött. Próbáld újra.',
    retry: 'Újra',
  },
  es: {
    title: 'Algo salió mal',
    body: 'La aplicación encontró un problema inesperado. Puedes intentarlo de nuevo.',
    retry: 'Reintentar',
  },
}

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    captureException(error, { componentStack: info.componentStack ?? undefined })
  }

  handleReset = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    let lang: Lang = 'en'
    try {
      lang = useAuthStore.getState().language
    } catch {
      lang = 'en'
    }
    const copy = COPY[lang] ?? COPY.en

    // This is a class component, so the theme is read imperatively from the
    // store instead of via useColors(). Same defensive try/catch as the
    // language read above: the boundary has to render even when a store is the
    // thing that blew up. Previously the sheet was pinned to DarkColors, which
    // dropped a full-bleed navy panel into an otherwise light-mode app.
    let isDark = false
    try {
      isDark = useThemeStore.getState().isDark
    } catch {
      isDark = false
    }
    const styles = getStyles(isDark)

    return (
      <View style={styles.container}>
        <Ionicons
          name="warning-outline"
          size={48}
          color={getColors(isDark).warning}
          style={styles.icon}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.body}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={this.handleReset}
          accessibilityRole="button"
          accessibilityLabel={copy.retry}
        >
          <Text style={styles.buttonText}>{copy.retry}</Text>
        </TouchableOpacity>
      </View>
    )
  }
}

// One sheet per theme, built lazily and cached — the crash screen must not
// rebuild its StyleSheet on every retry press.
const styleCache: Partial<Record<'light' | 'dark', ReturnType<typeof makeStyles>>> = {}

function getStyles(isDark: boolean) {
  const key = isDark ? 'dark' : 'light'
  return (styleCache[key] ??= makeStyles(getColors(isDark)))
}

function makeStyles(C: ReturnType<typeof getColors>) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  icon: {
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h2,
    color: C.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  body: {
    ...Typography.body,
    color: C.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  button: {
    backgroundColor: C.primary,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.base,
    borderRadius: Radius.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  buttonText: {
    ...Typography.h4,
    color: C.textInverse,
  },
  })
}
