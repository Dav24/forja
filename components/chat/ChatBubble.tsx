import { View } from 'react-native';
import { StreamingText } from './StreamingText';

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export function ChatBubble({ role, content, isStreaming = false }: ChatBubbleProps) {
  const isUser = role === 'user';

  return (
    <View className={`mb-3 ${isUser ? 'items-end' : 'items-start'}`}>
      <View
        className={`max-w-[85%] px-4 py-3 ${
          isUser
            ? 'bg-primary rounded-2xl rounded-tr-sm'
            : 'bg-surfaceElevated rounded-2xl rounded-tl-sm'
        }`}
      >
        <StreamingText
          text={content}
          isStreaming={isStreaming}
          style={{
            fontFamily: isUser ? 'Inter-Medium' : 'Inter-Regular',
            fontSize: 15,
            lineHeight: 22,
            color: isUser ? '#0A0A0F' : '#F1F5F9',
          }}
        />
      </View>
    </View>
  );
}
