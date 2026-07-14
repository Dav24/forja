import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/lib/theme';
import { gradientsByTheme } from '@/constants/themes';

type BadgeVariant = 'primary' | 'accent' | 'warning' | 'destructive' | 'muted' | 'premium';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<Exclude<BadgeVariant, 'premium'>, { container: string; text: string; bgToken?: 'chipWarning' | 'chipDanger' }> = {
  primary:     { container: 'bg-primary-dim border border-primary',  text: 'text-primary' },
  accent:      { container: 'border border-accent',                  text: 'text-accent',      bgToken: 'chipWarning' },
  warning:     { container: 'border border-warning',                 text: 'text-warning',      bgToken: 'chipWarning' },
  destructive: { container: 'border border-destructive',             text: 'text-destructive',  bgToken: 'chipDanger' },
  muted:       { container: 'bg-surface border border-border',       text: 'text-text-muted' },
};

export function Badge({ label, variant = 'muted', className = '' }: BadgeProps) {
  const { colors, resolved } = useTheme();
  const gradients = gradientsByTheme[resolved];
  if (variant === 'premium') {
    return (
      <LinearGradient
        colors={gradients.ember}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 9999, alignSelf: 'flex-start' }}
      >
        <View className={`rounded-full px-3 py-1 flex-row items-center gap-1 ${className}`}>
          {/* Siempre texto carbón oscuro sobre el degradado ember (cálido y brillante
              en ambos temas) — contraste, no depende de tema */}
          <Text className="text-xs font-bold" style={{ color: '#0C0A09' }}>⚒ {label}</Text>
        </View>
      </LinearGradient>
    );
  }

  const v = variantStyles[variant];
  const bgStyle = v.bgToken ? { backgroundColor: colors[v.bgToken] } : undefined;
  return (
    <View className={`${v.container} rounded-full px-3 py-1 self-start ${className}`} style={bgStyle}>
      <Text className={`${v.text} text-xs font-semibold`}>{label}</Text>
    </View>
  );
}
