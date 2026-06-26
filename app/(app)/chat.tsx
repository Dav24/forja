import { useRef, useEffect } from 'react';
import { View, FlatList, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatBubble } from '@/components/chat/ChatBubble';
import { ChatInput } from '@/components/chat/ChatInput';
import { MessageLimitBanner } from '@/components/chat/MessageLimitBanner';
import { useChat, type ChatMessage } from '@/hooks/useChat';
import { colors } from '@/constants/colors';

function EmptyState() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
      <Text style={{ fontSize: 48 }}>💪</Text>
      <Text
        style={{
          color: colors.text,
          fontSize: 22,
          fontFamily: 'SpaceGrotesk-Bold',
          marginTop: 16,
          textAlign: 'center',
        }}
      >
        Hola, soy Memo
      </Text>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 15,
          fontFamily: 'Inter-Regular',
          marginTop: 8,
          textAlign: 'center',
          lineHeight: 22,
        }}
      >
        Tu coach en Forja. Cuéntame cuál es tu objetivo y te armo un plan personalizado.
      </Text>
    </View>
  );
}

function renderItem({ item }: { item: ChatMessage }) {
  return (
    <ChatBubble
      role={item.role}
      content={item.content}
      isStreaming={item.isStreaming}
    />
  );
}

export default function ChatScreen() {
  const { messages, isLoading, dailyCount, limitReached, sendMessage } = useChat();
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 0) {
      // Pequeño delay para que el layout esté listo antes de hacer scroll
      const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
      return () => clearTimeout(t);
    }
  }, [messages.length]);

  // Scroll al actualizar contenido durante streaming
  const handleContentSizeChange = () => {
    if (isLoading) {
      listRef.current?.scrollToEnd({ animated: false });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text style={{ color: colors.text, fontFamily: 'SpaceGrotesk-Bold', fontSize: 18 }}>
          Memo el Forjador
        </Text>
        <Text style={{ color: colors.primary, fontFamily: 'Inter-Medium', fontSize: 12 }}>
          Tu coach de IA · Forja
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            onContentSizeChange={handleContentSizeChange}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
          />
        )}

        <MessageLimitBanner count={dailyCount} limitReached={limitReached} />
        <ChatInput onSend={sendMessage} disabled={isLoading || limitReached} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
