import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/lib/theme';
import { FREE_LIMITS } from '@/lib/limits';

interface MessageLimitBannerProps {
  count: number;
  limitReached: boolean;
}

export function MessageLimitBanner({ count, limitReached }: MessageLimitBannerProps) {
  const { colors } = useTheme();
  const { t } = useTranslation('chat');
  const remaining = FREE_LIMITS.MESSAGES_PER_DAY - count;
  const isLow = remaining <= 5 && remaining > 0;

  if (limitReached) {
    return (
      <View
        style={{
          marginHorizontal: 16,
          marginBottom: 8,
          backgroundColor: colors.destructive + '1A',
          borderWidth: 1,
          borderColor: colors.destructive + '40',
          borderRadius: 12,
          padding: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Ionicons name="warning-outline" size={18} color={colors.destructive} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.destructive, fontFamily: 'Inter-Bold', fontSize: 13 }}>
            {t('limitBanner.reachedTitle')}
          </Text>
          <Text style={{ color: colors.destructive + '99', fontFamily: 'Inter-Regular', fontSize: 12, marginTop: 2 }}>
            {t('limitBanner.reachedSubtitle')}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(app)/upgrade' as never)}
          activeOpacity={0.8}
          style={{ backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
        >
          <Text style={{ color: colors.background, fontFamily: 'Inter-Bold', fontSize: 12 }}>
            {t('limitBanner.premiumCta')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isLow) return null;

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 8,
        backgroundColor: colors.warning + '1A',
        borderWidth: 1,
        borderColor: colors.warning + '33',
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <Ionicons name="flash-outline" size={16} color={colors.warning} />
      <Text style={{ color: colors.warning, fontFamily: 'Inter-Regular', fontSize: 12, flex: 1 }}>
        {t(remaining === 1 ? 'limitBanner.remainingOne' : 'limitBanner.remainingOther', { count: remaining })}
      </Text>
    </View>
  );
}
