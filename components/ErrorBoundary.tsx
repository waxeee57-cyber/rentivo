import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { DarkColors as C, Spacing, Radius, Typography } from '@/constants/colors'
import { useAuthStore } from '@/lib/store/useAuthStore'
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

    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>🌴</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  emoji: {
    fontSize: 48,
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
