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

const variantStyles: Record<Exclude<BadgeVariant, 'premium'>, { container: string; text: string }> = {
  primary:     { container: 'bg-primary-dim border border-primary',       text: 'text-primary' },
  accent:      { container: 'bg-[#451a03] border border-accent',          text: 'text-accent' },
  warning:     { container: 'bg-[#451a03] border border-warning',          text: 'text-warning' },
  destructive: { container: 'bg-[#450a0a] border border-destructive',      text: 'text-destructive' },
  muted:       { container: 'bg-surface border border-border',             text: 'text-text-muted' },
};

export function Badge({ label, variant = 'muted', className = '' }: BadgeProps) {
  const { resolved } = useTheme();
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
          <Text className="text-xs font-bold" style={{ color: '#0C0A09' }}>⚒ {label}</Text>
        </View>
      </LinearGradient>
    );
  }

  const v = variantStyles[variant];
  return (
    <View className={`${v.container} rounded-full px-3 py-1 self-start ${className}`}>
      <Text className={`${v.text} text-xs font-semibold`}>{label}</Text>
    </View>
  );
}
