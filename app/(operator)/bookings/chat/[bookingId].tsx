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

function formatMsgTime(iso: string): string {
  try { return format(new Date(iso), 'HH:mm') } catch { return '' }
}

function MessageBubble({ msg }: { msg: Message }) {
  if (msg.sender_role === 'system') {
    return (
      <View style={styles.systemMsg}>
        <Text style={styles.systemMsgText}>{msg.content}</Text>
      </View>
    )
  }
  const isMe = msg.sender_role === 'operator'
  return (
    <View style={[styles.bubbleWrapper, isMe ? styles.bubbleWrapperRight : styles.bubbleWrapperLeft]}>
      <View style={[isMe ? styles.operatorBubble : styles.consumerBubble]}>
        <Text style={[styles.bubbleText, isMe && styles.bubbleTextOperator]}>
          {msg.content}
        </Text>
      </View>
      <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeRight]}>
        {formatMsgTime(msg.created_at)}
      </Text>
    </View>
  )
}

export default function OperatorChatScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>()
  const id = Config.useMock ? (bookingId ?? 'bk-001') : (bookingId ?? '')
  const { booking } = useBooking(id)

  const [messages, setMessages] = useState<Message[]>([])
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

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

  const sendMessage = async () => {
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
      sendChatNotification('consumer', booking?.operator?.name ?? 'CostaSol Car Rent', text, true)
      setSending(false)
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
        sender_role: 'operator',
        sender_id: null,
        content: text,
      })
      await supabase
        .from('rentivo_conversations')
        .update({ last_message: text, last_message_at: new Date().toISOString(), unread_consumer: (conversation?.unread_consumer ?? 0) + 1 })
        .eq('id', convId)
      sendChatNotification('consumer', booking?.operator?.name ?? 'CostaSol Car Rent', text, false)
    } finally {
      setSending(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader
        title={booking?.guest_name ?? 'Guest Chat'}
        subtitle={booking?.listing?.title}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          data={messages}
          keyExtractor={m => m.id}
          inverted
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => <MessageBubble msg={item} />}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatText}>No messages yet.</Text>
            </View>
          }
        />

        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Reply to guest..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!input.trim() || sending}
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
  operatorBubble: {
    backgroundColor: Colors.primary,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  consumerBubble: {
    backgroundColor: Colors.surfaceWarm,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bubbleText: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  bubbleTextOperator: { color: Colors.textInverse },
  bubbleTime: { fontSize: 10, color: Colors.textTertiary, marginTop: 2 },
  bubbleTimeRight: { textAlign: 'right' },
  systemMsg: { alignSelf: 'center', marginVertical: Spacing.sm, maxWidth: '70%' },
  systemMsgText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 18,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.surfaceWarm,
    borderRadius: Radius.xxl,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    color: Colors.text,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.textTertiary },
})
