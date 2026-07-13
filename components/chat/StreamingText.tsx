import { Text, TextProps } from 'react-native';
import { useTheme } from '@/lib/theme';

interface StreamingTextProps extends TextProps {
  text: string;
  isStreaming: boolean;
}

export function StreamingText({ text, isStreaming, ...props }: StreamingTextProps) {
  const { colors } = useTheme();
  return (
    <Text {...props}>
      {text}
      {isStreaming ? <Text style={{ color: colors.primary }}>▌</Text> : null}
    </Text>
  );
}
