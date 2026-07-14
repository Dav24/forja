import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/lib/theme';
import { StreamingText } from './StreamingText';

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

// Punto del indicador "escribiendo" (prototipo .typing i): fade+bounce en loop,
// escalonado por dot. El worklet solo lee el shared value — nada de funciones JS
// dentro de useAnimatedStyle (regla del proyecto: crashea en runtime, tsc no lo ve).
function TypingDot({ delay, color }: { delay: number; color: string }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0, { duration: 600 }),
        ),
        -1,
        false,
      ),
    );
  }, [delay]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.4 + progress.value * 0.6,
    transform: [{ translateY: progress.value * -3 }],
  }));

  return (
    <Animated.View
      style={[{ width: 5, height: 5, borderRadius: 99, backgroundColor: color }, style]}
    />
  );
}

function TypingDots({ color }: { color: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, paddingVertical: 8, paddingHorizontal: 2 }}>
      <TypingDot delay={0} color={color} />
      <TypingDot delay={180} color={color} />
      <TypingDot delay={360} color={color} />
    </View>
  );
}

export function ChatBubble({ role, content, isStreaming = false }: ChatBubbleProps) {
  const { colors } = useTheme();
  const isUser = role === 'user';
  // Antes de que llegue el primer token, el mensaje del asistente está vacío
  // y streameando — ese es el momento "escribiendo" (no hay un estado separado
  // en useChat/ChatMessage; se deriva de content vacío + isStreaming).
  const showTyping = !isUser && isStreaming && content.length === 0;

  return (
    <View className={`mb-4 ${isUser ? 'items-end' : 'items-start'}`}>
      {isUser ? (
        <View
          style={{
            maxWidth: '78%',
            paddingVertical: 11,
            paddingHorizontal: 15,
            backgroundColor: colors.surfaceElevated,
            borderWidth: 1,
            borderColor: colors.border,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderBottomRightRadius: 5,
            borderBottomLeftRadius: 20,
          }}
        >
          <StreamingText
            text={content}
            isStreaming={isStreaming}
            style={{
              fontFamily: 'Inter-Regular',
              fontSize: 14,
              lineHeight: 20,
              color: colors.text,
            }}
          />
        </View>
      ) : (
        <View style={{ maxWidth: '88%', paddingTop: 2 }}>
          {showTyping ? (
            <TypingDots color={colors.primary} />
          ) : (
            <StreamingText
              text={content}
              isStreaming={isStreaming}
              style={{
                fontFamily: 'Inter-Regular',
                fontSize: 14.5,
                lineHeight: 23,
                color: colors.text,
              }}
            />
          )}
        </View>
      )}
    </View>
  );
}
