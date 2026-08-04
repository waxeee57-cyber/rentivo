import React, { useState, useRef, useCallback, useMemo } from 'react'
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Spacing, Radius, Typography, Fonts } from '@/constants/colors'
import { t } from '@/constants/i18n'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'
import { useColors } from '@/lib/hooks/useColors'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

// Fallback when rental-assistant Edge Function is unavailable
const MOCK_REPLIES: Record<string, string> = {
  default: 'I can help you find the perfect rental! We have cars, boats, villas, and more available in Marbella and Budapest. What are you looking for?',
  car: 'Great choice! We have sedans from €45/day and SUVs from €75/day in Marbella. Would you like to see available dates?',
  boat: 'We have kayaks from €25/day and luxury yachts from €350/day. Most are available in the Costa del Sol area.',
  weekend: 'This weekend we have 12 vehicles available in Marbella and 8 in Budapest. Shall I filter by category?',
}

function getMockReply(text: string): string {
  const lower = text.toLowerCase()
  if (lower.includes('car') || lower.includes('vehicle')) return MOCK_REPLIES.car
  if (lower.includes('boat') || lower.includes('yacht') || lower.includes('kayak')) return MOCK_REPLIES.boat
  if (lower.includes('weekend') || lower.includes('saturday') || lower.includes('sunday')) return MOCK_REPLIES.weekend
  return MOCK_REPLIES.default
}

export default function AssistantScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { language } = useAuthStore()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const scrollViewRef = useRef<ScrollView>(null)

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isTyping) return

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
    }

    setMessages(prev => [...prev, userMsg])
    setInputText('')
    setIsTyping(true)

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true })
    }, 50)

    if (Config.useMock) {
      await new Promise<void>(resolve => setTimeout(resolve, 1200 + Math.random() * 800))
      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: getMockReply(trimmed),
      }
      setMessages(prev => [...prev, assistantMsg])
      setIsTyping(false)
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true })
      }, 50)
      return
    }

    try {
      const history = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }))

      const { data, error } = await supabase.functions.invoke('rental-assistant', {
        body: { messages: history },
      })

      if (error) throw error

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: (data as { response: string }).response,
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: t('assistantError', language),
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setIsTyping(false)
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true })
      }, 50)
    }
  }, [isTyping, messages, language])

  const handleSend = useCallback(() => {
    void sendMessage(inputText)
  }, [inputText, sendMessage])

  const handleSuggestion = useCallback((text: string) => {
    void sendMessage(text)
  }, [sendMessage])

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBack}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <View style={styles.headerIcon}>
          {/* Decorative section icon → muted ink; accent is CTA-only. */}
          <Ionicons name="chatbubble-ellipses" size={20} color={C.textSecondary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{t('assistantTitle', language)}</Text>
          <Text style={styles.headerSubtitle}>{t('assistantSubtitle', language)}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {/* Messages area */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messageArea}
          contentContainerStyle={styles.messageContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Empty state / welcome */}
          {messages.length === 0 && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                {/* Decorative empty-state icon → muted ink. */}
                <Ionicons name="chatbubble-ellipses" size={40} color={C.textTertiary} />
              </View>
              <Text style={styles.emptyText}>{t('assistantEmpty', language)}</Text>

              {/* Quick suggestion chips */}
              <View style={styles.chips}>
                <TouchableOpacity
                  style={styles.chip}
                  onPress={() => handleSuggestion(t('assistantSuggest1', language))}
                  accessibilityLabel={t('assistantSuggest1', language)}
                  accessibilityRole="button"
                >
                  <Ionicons name="car-outline" size={14} color={C.textSecondary} />
                  <Text style={styles.chipText}>{t('assistantSuggest1', language)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.chip}
                  onPress={() => handleSuggestion(t('assistantSuggest2', language))}
                  accessibilityLabel={t('assistantSuggest2', language)}
                  accessibilityRole="button"
                >
                  <Ionicons name="boat-outline" size={14} color={C.textSecondary} />
                  <Text style={styles.chipText}>{t('assistantSuggest2', language)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.chip}
                  onPress={() => handleSuggestion(t('assistantSuggest3', language))}
                  accessibilityLabel={t('assistantSuggest3', language)}
                  accessibilityRole="button"
                >
                  <Ionicons name="calendar-outline" size={14} color={C.textSecondary} />
                  <Text style={styles.chipText}>{t('assistantSuggest3', language)}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Suggestion chips above messages (once conversation started) */}
          {messages.length > 0 && (
            <View style={styles.chipsRow}>
              <TouchableOpacity
                style={styles.chipSmall}
                onPress={() => handleSuggestion(t('assistantSuggest1', language))}
                accessibilityLabel={t('assistantSuggest1', language)}
                accessibilityRole="button"
              >
                <Text style={styles.chipSmallText}>{t('assistantSuggest1', language)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.chipSmall}
                onPress={() => handleSuggestion(t('assistantSuggest2', language))}
                accessibilityLabel={t('assistantSuggest2', language)}
                accessibilityRole="button"
              >
                <Text style={styles.chipSmallText}>{t('assistantSuggest2', language)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.chipSmall}
                onPress={() => handleSuggestion(t('assistantSuggest3', language))}
                accessibilityLabel={t('assistantSuggest3', language)}
                accessibilityRole="button"
              >
                <Text style={styles.chipSmallText}>{t('assistantSuggest3', language)}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Message bubbles */}
          {messages.map(msg => (
            <View
              key={msg.id}
              style={[
                styles.bubbleWrap,
                msg.role === 'user' ? styles.bubbleWrapUser : styles.bubbleWrapAssistant,
              ]}
            >
              {msg.role === 'assistant' && (
                <View style={styles.avatarDot}>
                  {/* Assistant identity chip, not an action → muted ink. */}
                  <Ionicons name="chatbubble-ellipses" size={12} color={C.textSecondary} />
                </View>
              )}
              <View
                style={[
                  styles.bubble,
                  msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    msg.role === 'user' && styles.bubbleTextUser,
                  ]}
                >
                  {msg.content}
                </Text>
              </View>
            </View>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <View style={[styles.bubbleWrap, styles.bubbleWrapAssistant]}>
              <View style={styles.avatarDot}>
                <Ionicons name="chatbubble-ellipses" size={12} color={C.textSecondary} />
              </View>
              <View style={[styles.bubble, styles.bubbleAssistant, styles.typingBubble]}>
                {/* Busy state, not a CTA → muted ink. */}
                <ActivityIndicator size="small" color={C.textSecondary} />
                <Text style={styles.typingText}>{t('assistantTyping', language)}</Text>
              </View>
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder={t('assistantPlaceholder', language)}
            placeholderTextColor={C.textTertiary}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            accessibilityLabel={t('assistantPlaceholder', language)}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || isTyping) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || isTyping}
            accessibilityLabel={t('assistantSend', language)}
            accessibilityRole="button"
          >
            <Ionicons name="send" size={18} color={C.textInverse} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: C.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: Spacing.sm,
  },
  headerBack: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -Spacing.sm,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    // Neutral chip — the accent tint is reserved for the CTA.
    backgroundColor: C.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  headerTitle: {
    ...Typography.h4,
    color: C.text,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: C.textTertiary,
    marginTop: 2,
  },

  // Message area
  messageArea: { flex: 1 },
  messageContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    flexGrow: 1,
  },
  bottomSpacer: { height: Spacing.md },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    backgroundColor: C.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.base,
  },
  emptyText: {
    ...Typography.body,
    color: C.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },

  // Chips (empty state)
  chips: {
    gap: Spacing.sm,
    alignItems: 'center',
    width: '100%',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    // Suggestion chips are secondary affordances — neutral, so the Send CTA
    // stays the only orange thing on screen. C.text on surfaceWarm = 15:1/13:1.
    backgroundColor: C.surfaceWarm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 44,
  },
  chipText: {
    ...Typography.bodyS,
    color: C.text,
    fontFamily: Fonts.semibold,
  },

  // Chips (inline row above messages)
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  chipSmall: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: C.surfaceWarm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipSmallText: {
    ...Typography.caption,
    color: C.text,
    fontFamily: Fonts.semibold,
  },

  // Bubbles
  bubbleWrap: {
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.xs,
    maxWidth: '85%',
  },
  bubbleWrapUser: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  bubbleWrapAssistant: { alignSelf: 'flex-start' },
  avatarDot: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    backgroundColor: C.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flex: 1,
  },
  bubbleUser: {
    backgroundColor: C.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: C.surfaceWarm,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  bubbleText: {
    ...Typography.body,
    color: C.text,
    lineHeight: 20,
  },
  bubbleTextUser: {
    color: C.textInverse,
  },

  // Typing indicator
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: 12,
  },
  typingText: {
    ...Typography.bodyS,
    color: C.textTertiary,
    fontStyle: 'italic',
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    backgroundColor: C.surfaceWarm,
    borderRadius: Radius.xxl,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    fontFamily: Fonts.regular, fontSize: 14,
    color: C.text,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: C.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: C.textTertiary,
  },
  })
}
