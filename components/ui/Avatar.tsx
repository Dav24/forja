import { Image, Text, View } from 'react-native';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  name?: string | null;
  imageUrl?: string | null;
  size?: AvatarSize;
  className?: string;
}

const sizeMap: Record<AvatarSize, { container: string; text: string; px: number }> = {
  sm: { container: 'w-8 h-8',   text: 'text-xs',  px: 32 },
  md: { container: 'w-10 h-10', text: 'text-sm',  px: 40 },
  lg: { container: 'w-14 h-14', text: 'text-lg',  px: 56 },
  xl: { container: 'w-20 h-20', text: 'text-2xl', px: 80 },
};

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function Avatar({ name, imageUrl, size = 'md', className = '' }: AvatarProps) {
  const s = sizeMap[size];

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        className={`${s.container} rounded-full ${className}`}
        style={{ width: s.px, height: s.px, borderRadius: s.px / 2 }}
      />
    );
  }

  const initials = name ? getInitials(name) : '?';

  return (
    <View className={`${s.container} rounded-full bg-primary-dim items-center justify-center ${className}`}>
      <Text className={`${s.text} text-primary font-bold`}>{initials}</Text>
    </View>
  );
}
