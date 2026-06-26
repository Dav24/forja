import { Text, TextProps } from 'react-native';
import { colors } from '@/constants/colors';

interface StreamingTextProps extends TextProps {
  text: string;
  isStreaming: boolean;
}

export function StreamingText({ text, isStreaming, ...props }: StreamingTextProps) {
  return (
    <Text {...props}>
      {text}
      {isStreaming ? <Text style={{ color: colors.primary }}>▌</Text> : null}
    </Text>
  );
}
