import { View } from 'react-native';
import { useTheme } from '@/lib/theme';
import { StreamingText } from './StreamingText';
import { VulcanoAvatar } from './VulcanoAvatar';

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export function ChatBubble({ role, content, isStreaming = false }: ChatBubbleProps) {
  const { colors } = useTheme();
  const isUser = role === 'user';

  return (
    <View className={`mb-3 ${isUser ? 'items-end' : 'items-start'}`}>
      {isUser ? (
        <View className="max-w-[85%] px-4 py-3 bg-primary-dim rounded-2xl rounded-tr-sm">
          <StreamingText
            text={content}
            isStreaming={isStreaming}
            style={{
              fontFamily: 'Inter-Medium',
              fontSize: 15,
              lineHeight: 22,
              color: colors.text,
            }}
          />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <VulcanoAvatar size={30} />
          <View
            className="max-w-[85%] px-4 py-3 bg-surface rounded-2xl rounded-tl-sm"
            style={{ borderWidth: 1, borderColor: 'rgba(249,115,22,0.35)' }}
          >
            <StreamingText
              text={content}
              isStreaming={isStreaming}
              style={{
                fontFamily: 'Inter-Regular',
                fontSize: 15,
                lineHeight: 22,
                color: colors.text,
              }}
            />
          </View>
        </View>
      )}
    </View>
  );
}
