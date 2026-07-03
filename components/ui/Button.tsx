import { ActivityIndicator, Pressable, PressableProps, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, fireShadow, gradients } from '@/constants/colors';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends PressableProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  label: string;
  className?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const sizeStyles: Record<Size, { container: string; text: string; radius: number }> = {
  sm: { container: 'h-10 px-4 rounded-xl', text: 'text-sm', radius: 12 },
  md: { container: 'h-14 px-5 rounded-xl', text: 'text-base', radius: 12 },
  lg: { container: 'h-16 px-6 rounded-2xl', text: 'text-lg', radius: 16 },
};

const flatVariants: Record<Exclude<Variant, 'primary'>, { container: string; text: string; indicator: string }> = {
  secondary: { container: 'bg-surface border border-primary', text: 'text-primary', indicator: colors.primary },
  ghost: { container: 'bg-transparent', text: 'text-text-muted', indicator: colors.text },
  destructive: { container: 'bg-destructive', text: 'text-white', indicator: '#ffffff' },
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
  const s = sizeStyles[size];
  const isDisabled = disabled || loading;
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = () => { scale.value = withSpring(0.97, { damping: 15, stiffness: 400 }); };
  const handlePressOut = () => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); };

  if (variant === 'primary') {
    return (
      <AnimatedPressable
        disabled={isDisabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        className={className}
        style={[pressStyle, isDisabled ? { opacity: 0.5 } : fireShadow]}
        {...props}
      >
        <LinearGradient
          colors={gradients.ember}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: s.radius }}
        >
          <View className={`${s.container} items-center justify-center flex-row gap-2`}>
            {loading
              ? <ActivityIndicator color={colors.background} size="small" />
              : <Text className={`${s.text} font-bold`} style={{ color: colors.background }}>{label}</Text>
            }
          </View>
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  const v = flatVariants[variant];
  return (
    <AnimatedPressable
      disabled={isDisabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      className={`${v.container} ${s.container} items-center justify-center flex-row gap-2 ${isDisabled ? 'opacity-50' : ''} ${className}`}
      style={pressStyle}
      {...props}
    >
      {loading
        ? <ActivityIndicator color={v.indicator} size="small" />
        : <Text className={`${v.text} ${s.text} font-bold`}>{label}</Text>
      }
    </AnimatedPressable>
  );
}
