import type { ComponentProps, ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

interface GroupCardProps {
  title: string;
  iconName: IoniconsName;
  /** 'primary' (ember, entrenamiento) por defecto; 'accent' (ámbar, nutrición) para pantallas de esa familia. */
  tint?: 'primary' | 'accent';
  children: ReactNode;
}

// Card de agrupación para pantallas de formulario/ajustes — evita la "lista plana
// de título + fila de chips" (ver DESIGN.md §6 Don't).
export function GroupCard({ title, iconName, tint = 'primary', children }: GroupCardProps) {
  const { colors } = useTheme();
  const badgeBg = tint === 'accent' ? colors.accent + '20' : colors.primaryDim;
  const iconColor = tint === 'accent' ? colors.accent : colors.primary;
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: badgeBg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={iconName} size={14} color={iconColor} />
        </View>
        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 17, color: colors.text }}>{title}</Text>
      </View>
      {children}
    </View>
  );
}
