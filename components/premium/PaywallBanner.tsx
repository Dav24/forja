import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/lib/theme';

interface PaywallBannerProps {
  message: string;
  ctaLabel?: string;
  onPress: () => void;
}

export function PaywallBanner({ message, ctaLabel, onPress }: PaywallBannerProps) {
  const { colors } = useTheme();
  const { t } = useTranslation('plans');
  const resolvedCta = ctaLabel ?? t('paywall.defaultCta');
  return (
    <View
      style={{
        backgroundColor: colors.accent + '1A',
        borderWidth: 1,
        borderColor: colors.accent + '40',
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <Ionicons name="flash-outline" size={18} color={colors.accent} />
      <Text
        style={{ flex: 1, fontFamily: 'Inter-Regular', fontSize: 13, color: colors.text }}
      >
        {message}
      </Text>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={{
          backgroundColor: colors.accent,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 6,
        }}
      >
        <Text style={{ color: colors.background, fontFamily: 'Inter-Bold', fontSize: 12 }}>
          {resolvedCta}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
