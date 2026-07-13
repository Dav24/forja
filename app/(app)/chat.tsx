import { useRef, useEffect } from 'react';
import { View, FlatList, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ChatBubble } from '@/components/chat/ChatBubble';
import { ChatInput } from '@/components/chat/ChatInput';
import { MessageLimitBanner } from '@/components/chat/MessageLimitBanner';
import { VulcanoAvatar } from '@/components/chat/VulcanoAvatar';
import { useChat, type ChatMessage } from '@/hooks/useChat';
import { StaggerIn } from '@/components/ui/StaggerIn';
import { useTheme } from '@/lib/theme';

function EmptyState() {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();

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
        {t('empty.greeting')}
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
        {t('empty.subtitle')}
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
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
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
      <StaggerIn index={0}>
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View className="flex-row items-center gap-3">
            <VulcanoAvatar size={38} />
            <View>
              <Text className="text-text font-bold text-base" style={{ fontFamily: 'SpaceGrotesk-Bold' }}>{t('header.name')}</Text>
              <Text className="text-text-muted text-xs">{t('header.subtitle')}</Text>
            </View>
          </View>
        </View>
      </StaggerIn>

      {/* En Android la ventana ya se encoge sola con el teclado (softwareKeyboardLayoutMode
          resize) — un behavior aquí restaría la altura del teclado dos veces y empuja el
          input fuera de pantalla. Solo iOS necesita compensación. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
