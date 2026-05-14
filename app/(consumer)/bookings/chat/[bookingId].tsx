import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import * as Haptics from 'expo-haptics'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { useBooking } from '@/lib/hooks/useBookings'
import { supabase } from '@/lib/supabase'
import { Config } from '@/constants/config'
import { MOCK_CONVERSATIONS, MOCK_MESSAGES } from '@/lib/mockData'
import { sendChatNotification } from '@/lib/notifications'
import type { Message, Conversation } from '@/types'
import { format } from 'date-fns'

const MOCK_OPERATOR_REPLIES = [
  'Hi! The vehicle will be ready at 10:00.',
  "Sure, I'll have it ready for you!",
  'No problem, see you then!',
  'The address is: Calle Principal 12, Marbella.',
  'Feel free to contact me if you need anything.',
  'Great! Looking forward to meeting you.',
]

function formatMsgTime(iso: string): string {
  try { return format(new Date(iso), 'HH:mm') } catch { return '' }
}

function shouldShowTimestamp(msg: Message, prevMsg: Message | null): boolean {
  if (!prevMsg) return true
  const diff = new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()
  return diff > 30 * 60 * 1000
}

function MessageBubble({ msg, isConsumer }: { msg: Message; isConsumer: boolean }) {
  if (msg.sender_role === 'system') {
    return (
      <View style={styles.systemMsg}>
        <Text style={styles.systemMsgText}>{msg.content}</Text>
      </View>
    )
  }
  const isMe = isConsumer && msg.sender_role === 'consumer'
  return (
    <View style={[styles.bubbleWrapper, isMe ? styles.bubbleWrapperRight : styles.bubbleWrapperLeft]}>
      <View style={[isMe ? styles.consumerBubble : styles.operatorBubble]}>
        <Text style={[styles.bubbleText, isMe && styles.bubbleTextConsumer]}>
          {msg.content}
        </Text>
      </View>
      <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeRight]}>
        {formatMsgTime(msg.created_at)}
      </Text>
    </View>
  )
}

export default function ConsumerChatScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>()
  const id = Config.useMock ? (bookingId ?? 'bk-001') : (bookingId ?? '')
  const { booking } = useBooking(id)

  const [messages, setMessages] = useState<Message[]>([])
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<FlatList<Message>>(null)

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
      .channel(`messages:${conversation.id}`)
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
    const text = inputText.trim()
    if (!text || sending) return

    // Optimistic update — message appears instantly
    const optimisticMsg: Message = {
      id: `msg-${Date.now()}`,
      conversation_id: conversation?.id ?? 'conv-001',
      sender_role: 'consumer',
      sender_id: 'usr-001',
      content: text,
      read: false,
      created_at: new Date().toISOString(),
    }

    setMessages(prev => [optimisticMsg, ...prev])
    setInputText('')
    setSending(true)
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    if (Config.useMock) {
      sendChatNotification('operator', booking?.guest_name ?? 'Guest', text, true)
      setSending(false)

      // Simulate operator typing + reply after 2-3 seconds
      const delay = 2000 + Math.random() * 1000
      setTimeout(() => {
        const reply: Message = {
          id: `msg-${Date.now() + 1}`,
          conversation_id: 'conv-001',
          sender_role: 'operator',
          sender_id: 'op-001',
          content: MOCK_OPERATOR_REPLIES[Math.floor(Math.random() * MOCK_OPERATOR_REPLIES.length)],
          read: false,
          created_at: new Date().toISOString(),
        }
        setMessages(prev => [reply, ...prev])
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }, delay)
      return
    }

    try {
      let convId = conversation?.id
      if (!convId) {
        const { data: newConv } = await supabase
          .from('rentivo_conversations')
          .insert({
            booking_id: id,
            listing_id: booking?.listing_id ?? '',
            operator_id: booking?.operator_id ?? '',
            user_id: null,
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
        sender_role: 'consumer',
        sender_id: null,
        content: text,
      })
      await supabase
        .from('rentivo_conversations')
        .update({
          last_message: text,
          last_message_at: new Date().toISOString(),
          unread_operator: (conversation?.unread_operator ?? 0) + 1,
        })
        .eq('id', convId)
      sendChatNotification('operator', booking?.guest_name ?? 'Guest', text, false)
    } finally {
      setSending(false)
    }
  }, [inputText, sending, bookingId, conversation, booking, id])

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader
        title={booking?.listing?.title ?? 'Chat'}
        subtitle={booking?.operator?.name}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          inverted
          contentContainerStyle={styles.messageList}
          renderItem={({ item, index }) => {
            const nextMsg = messages[index + 1] ?? null
            const showTs = shouldShowTimestamp(item, nextMsg)
            return (
              <>
                <MessageBubble msg={item} isConsumer />
                {showTs && index < messages.length - 1 && (
                  <Text style={styles.tsLabel}>{formatMsgTime(item.created_at)}</Text>
                )}
              </>
            )
          }}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatText}>No messages yet. Say hello! 👋</Text>
            </View>
          }
        />

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => void sendMessage()}
            accessibilityLabel="Message input"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
            onPress={() => void sendMessage()}
            disabled={!inputText.trim() || sending}
            accessibilityLabel="Send message"
            accessibilityRole="button"
          >
            <Ionicons name="send" size={18} color={Colors.textInverse} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  messageList: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.md },
  emptyChat: { flex: 1, alignItems: 'center', paddingTop: Spacing.xxxl },
  emptyChatText: { fontSize: 14, color: Colors.textTertiary },
  bubbleWrapper: { marginBottom: Spacing.xs, maxWidth: '80%' },
  bubbleWrapperRight: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleWrapperLeft: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  consumerBubble: {
    backgroundColor: Colors.primary,
    borderRadius: 18, borderBottomRightRadius: 4,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  operatorBubble: {
    backgroundColor: Colors.surfaceWarm,
    borderRadius: 18, borderBottomLeftRadius: 4,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  bubbleText: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  bubbleTextConsumer: { color: Colors.textInverse },
  bubbleTime: { fontSize: 10, color: Colors.textTertiary, marginTop: 2 },
  bubbleTimeRight: { textAlign: 'right' },
  systemMsg: { alignSelf: 'center', marginVertical: Spacing.sm, maxWidth: '70%' },
  systemMsgText: {
    fontSize: 12, color: Colors.textTertiary,
    fontStyle: 'italic', textAlign: 'center', lineHeight: 18,
  },
  tsLabel: {
    fontSize: 11, color: Colors.textTertiary,
    textAlign: 'center', marginVertical: Spacing.sm,
  },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderTopWidth: 1, borderTopColor: Colors.border, gap: Spacing.sm,
  },
  textInput: {
    flex: 1, backgroundColor: Colors.surfaceWarm,
    borderRadius: Radius.xxl, paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm, fontSize: 14, color: Colors.text,
    maxHeight: 100, borderWidth: 1, borderColor: Colors.border,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.textTertiary },
})
