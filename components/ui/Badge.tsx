import { Text, View } from 'react-native';

type BadgeVariant = 'primary' | 'accent' | 'warning' | 'destructive' | 'muted';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, { container: string; text: string }> = {
  primary:     { container: 'bg-primary-dim border border-primary',       text: 'text-primary' },
  accent:      { container: 'bg-[#1e1b4b] border border-accent',          text: 'text-accent' },
  warning:     { container: 'bg-[#451a03] border border-warning',          text: 'text-warning' },
  destructive: { container: 'bg-[#450a0a] border border-destructive',      text: 'text-destructive' },
  muted:       { container: 'bg-surface border border-border',             text: 'text-text-muted' },
};

export function Badge({ label, variant = 'muted', className = '' }: BadgeProps) {
  const v = variantStyles[variant];
  return (
    <View className={`${v.container} rounded-full px-3 py-1 self-start ${className}`}>
      <Text className={`${v.text} text-xs font-semibold`}>{label}</Text>
    </View>
  );
}
