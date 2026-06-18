import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import * as Haptics from 'expo-haptics'
import { Spacing, Radius } from '@/constants/colors'
import { useBooking } from '@/lib/hooks/useBookings'
import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'
import { MOCK_CONVERSATIONS, MOCK_MESSAGES } from '@/lib/mockData'
import { sendChatNotification } from '@/lib/notifications'
import { translateMessage } from '@/lib/api/translate'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useToastStore } from '@/lib/store/useToastStore'
import type { Message, Conversation } from '@/types'
import { format } from 'date-fns'
import { useColors } from '@/lib/hooks/useColors'
import { t } from '@/constants/i18n'

function formatMsgTime(iso: string): string {
  try { return format(new Date(iso), 'HH:mm') } catch { return '' }
}

type TranslationState = {
  text: string | null
  loading: boolean
}

type MessageBubbleProps = {
  msg: Message
  translation: TranslationState
  onTranslate: (messageId: string, content: string) => void
}

function MessageBubble({ msg, translation, onTranslate }: MessageBubbleProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const language = useAuthStore(s => s.language)
  if (msg.sender_role === 'system') {
    return (
      <View style={styles.systemMsg}>
        <Text style={styles.systemMsgText}>{msg.content}</Text>
      </View>
    )
  }
  const isMe = msg.sender_role === 'operator'
  const canTranslate = !isMe
  return (
    <View style={[styles.bubbleWrapper, isMe ? styles.bubbleWrapperRight : styles.bubbleWrapperLeft]}>
      <View style={[isMe ? styles.operatorBubble : styles.consumerBubble]}>
        <Text style={[styles.bubbleText, isMe && styles.bubbleTextOperator]}>
          {msg.content}
        </Text>
        {translation.text !== null && (
          <View style={styles.translationContainer}>
            <View style={styles.translationDivider} />
            <Text style={styles.translationText}>
              {translation.text}
            </Text>
          </View>
        )}
      </View>
      <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeRight]}>
        {formatMsgTime(msg.created_at)}
      </Text>
      {canTranslate && (
        <TouchableOpacity
          style={styles.translateBtn}
          onPress={() => onTranslate(msg.id, msg.content)}
          disabled={translation.loading}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={translation.text !== null ? t('opBkHideTranslation', language) : t('opBkTranslateMsg', language)}
          accessibilityRole="button"
        >
          {translation.loading ? (
            <ActivityIndicator size="small" color={C.primary} style={styles.translateSpinner} />
          ) : (
            <Text style={styles.translateBtnText}>
              {translation.text !== null ? t('opBkHideTranslation', language) : `🌐 ${t('opBkTranslate', language)}`}
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  )
}

export default function OperatorChatScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>()
  const id = Config.useMock ? (bookingId ?? 'bk-001') : (bookingId ?? '')
  const { booking } = useBooking(id)
  const language = useAuthStore(s => s.language)
  const { showToast } = useToastStore()

  const [messages, setMessages] = useState<Message[]>([])
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [translations, setTranslations] = useState<Record<string, TranslationState>>({})
  const listRef = useRef<FlatList<Message>>(null)

  const handleTranslate = useCallback(async (messageId: string, content: string) => {
    // Toggle off if already translated
    if (translations[messageId]?.text !== null && translations[messageId]?.text !== undefined) {
      setTranslations(prev => ({ ...prev, [messageId]: { text: null, loading: false } }))
      return
    }
    setTranslations(prev => ({ ...prev, [messageId]: { text: null, loading: true } }))
    try {
      const translated = await translateMessage(content, language as 'en' | 'es' | 'hu')
      setTranslations(prev => ({ ...prev, [messageId]: { text: translated, loading: false } }))
    } catch {
      setTranslations(prev => ({ ...prev, [messageId]: { text: null, loading: false } }))
    }
  }, [translations, language])

  const loadMessages = useCallback(async () => {
    if (Config.useMock) {
      const conv = MOCK_CONVERSATIONS.find(c => c.booking_id === id) ?? null
      setConversation(conv)
      setMessages([...MOCK_MESSAGES].reverse())
      return
    }
    const { data: convData } = await supabase
      .from('rentivo_conversations')
      .select('*')
      .eq('booking_id', id)
      .single()
    if (convData) {
      setConversation(convData as Conversation)
      const { data: msgData } = await supabase
        .from('rentivo_messages')
        .select('*')
        .eq('conversation_id', (convData as Conversation).id)
        .order('created_at', { ascending: false })
      setMessages((msgData as Message[]) ?? [])
    }
  }, [id])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  useEffect(() => {
    if (!conversation || Config.useMock) return
    const channel = supabase
      .channel(`op_messages:${conversation.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'rentivo_messages',
        filter: `conversation_id=eq.${conversation.id}`,
      }, (payload) => {
        setMessages(prev => [payload.new as Message, ...prev])
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [conversation])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    if (Config.useMock) {
      const newMsg: Message = {
        id: 'msg-op-' + Date.now(),
        conversation_id: 'conv-001',
        sender_role: 'operator',
        sender_id: 'op-001',
        content: text,
        read: false,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [newMsg, ...prev])
      setSending(false)
      return
    }

    try {
      // Authoritative auth id — must equal auth.uid() for the chat RLS INSERT
      // policy (msg_participant_insert: sender_id = auth.uid()). Demo / expired
      // session has none, so block instead of inserting a null sender.
      const { data: { session } } = await supabase.auth.getSession()
      const authUserId = session?.user?.id
      if (!authUserId) {
        setInput(text)
        showToast({ message: t('ternLoginRequired', language), type: 'error' })
        return
      }
      let convId = conversation?.id
      if (!convId) {
        const { data: newConv } = await supabase
          .from('rentivo_conversations')
          .insert({
            booking_id: id,
            listing_id: booking?.listing_id ?? '',
            operator_id: booking?.operator_id ?? '',
            user_id: session?.user?.id ?? null,
          })
          .select()
          .single()
        if (newConv) {
          setConversation(newConv as Conversation)
          convId = (newConv as Conversation).id
        }
      }
      if (!convId) return
      await supabase.from('rentivo_messages').insert({
        conversation_id: convId,
        sender_role: 'operator',
        sender_id: authUserId,
        content: text,
      })
      await supabase
        .from('rentivo_conversations')
        .update({ last_message: text, last_message_at: new Date().toISOString(), unread_consumer: (conversation?.unread_consumer ?? 0) + 1 })
        .eq('id', convId)
      // Notify consumer about new operator message
      if (booking?.user_id) {
        void sendChatNotification({
          recipientUserId: booking.user_id,
          senderName: booking.operator?.name ?? 'Host',
          message: text,
          bookingId: id,
        })
      }
    } finally {
      setSending(false)
    }
  }, [input, sending, conversation, booking, id, language, showToast])

  const renderItem = useCallback(({ item }: { item: Message }) => {
    const translation: TranslationState = translations[item.id] ?? { text: null, loading: false }
    return (
      <MessageBubble
        msg={item}
        translation={translation}
        onTranslate={handleTranslate}
      />
    )
  }, [translations, handleTranslate])

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader
        title={booking?.guest_name ?? t('opBkGuestChat', language)}
        subtitle={booking?.listing?.title}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          inverted
          contentContainerStyle={styles.messageList}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatText}>{t('messagesEmpty', language)}</Text>
            </View>
          }
        />

        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder={t('opBkReplyPlaceholder', language)}
            placeholderTextColor={C.textTertiary}
            multiline
            maxLength={500}
            accessibilityLabel={t('opBkMsgInput', language)}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
            onPress={() => void sendMessage()}
            disabled={!input.trim() || sending}
            accessibilityLabel={t('opBkSendMsg', language)}
            accessibilityRole="button"
            hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
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
  container: { flex: 1, backgroundColor: C.background },
  messageList: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.md },
  emptyChat: { flex: 1, alignItems: 'center', paddingTop: Spacing.xxxl },
  emptyChatText: { fontSize: 14, color: C.textTertiary },
  bubbleWrapper: { marginBottom: Spacing.xs, maxWidth: '80%' },
  bubbleWrapperRight: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleWrapperLeft: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  operatorBubble: {
    backgroundColor: C.primary,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  consumerBubble: {
    backgroundColor: C.surfaceWarm,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  bubbleText: { fontSize: 14, color: C.text, lineHeight: 20 },
  bubbleTextOperator: { color: C.textInverse },
  bubbleTime: { fontSize: 10, color: C.textTertiary, marginTop: 2 },
  bubbleTimeRight: { textAlign: 'right' },
  translationContainer: { marginTop: 6 },
  translationDivider: { height: 1, backgroundColor: 'rgba(0,0,0,0.12)', marginBottom: 6 },
  translationText: { fontSize: 13, color: C.text, lineHeight: 18, fontStyle: 'italic' },
  translateBtn: {
    marginTop: 4,
    minHeight: 20,
  },
  translateBtnText: {
    fontSize: 11,
    color: C.primary,
    fontWeight: '500',
  },
  translateSpinner: {
    height: 16,
  },
  systemMsg: { alignSelf: 'center', marginVertical: Spacing.sm, maxWidth: '70%' },
  systemMsgText: {
    fontSize: 12,
    color: C.textTertiary,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 18,
  },
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
    fontSize: 14,
    color: C.text,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: C.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: C.textTertiary },
  })
}
