import { ActivityIndicator, Text, TouchableOpacity, TouchableOpacityProps } from 'react-native';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends TouchableOpacityProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  label: string;
}

const variantStyles: Record<Variant, { container: string; text: string; indicator: string }> = {
  primary:     { container: 'bg-primary',              text: 'text-background',   indicator: '#0A0A0F' },
  secondary:   { container: 'bg-surface border border-border', text: 'text-text', indicator: '#F1F5F9' },
  ghost:       { container: 'bg-transparent',          text: 'text-text',         indicator: '#F1F5F9' },
  destructive: { container: 'bg-destructive',          text: 'text-white',        indicator: '#ffffff' },
};

const sizeStyles: Record<Size, { container: string; text: string }> = {
  sm: { container: 'h-10 px-4 rounded-xl',  text: 'text-sm' },
  md: { container: 'h-14 px-5 rounded-xl',  text: 'text-base' },
  lg: { container: 'h-16 px-6 rounded-2xl', text: 'text-lg' },
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  label,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      disabled={isDisabled}
      className={`${v.container} ${s.container} items-center justify-center flex-row gap-2 ${isDisabled ? 'opacity-50' : ''} ${className}`}
      {...props}
    >
      {loading
        ? <ActivityIndicator color={v.indicator} size="small" />
        : <Text className={`${v.text} ${s.text} font-bold`}>{label}</Text>
      }
    </TouchableOpacity>
  );
}
