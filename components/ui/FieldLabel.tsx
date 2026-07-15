import { Text } from 'react-native';
import { useTheme } from '@/lib/theme';

interface FieldLabelProps {
  children: string;
  first?: boolean;
}

// Eyebrow de subsección (mismo estilo que hub.mealPlanEyebrow en plans/index.tsx)
export function FieldLabel({ children, first = false }: FieldLabelProps) {
  const { colors } = useTheme();
  return (
    <Text
      style={{
        fontFamily: 'SpaceGrotesk-Bold',
        fontSize: 11,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        color: colors.textMuted,
        marginBottom: 10,
        marginTop: first ? 0 : 18,
      }}
    >
      {children}
    </Text>
  );
}
