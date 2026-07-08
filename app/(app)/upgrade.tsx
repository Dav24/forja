import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { useIsPremium } from '@/hooks/useSubscription';
import { colors, gradients } from '@/constants/colors';
import { useAuthStore } from '@/store/auth.store';
import { buildPaymentURL, buildPortalURL, type Billing } from '@/lib/payments';

const APRENDIZ_FEATURE_KEYS = [
  'upgrade.free.features.0',
  'upgrade.free.features.1',
  'upgrade.free.features.2',
  'upgrade.free.features.3',
  'upgrade.free.features.4',
];

const MAESTRO_FEATURE_KEYS = [
  'upgrade.premium.features.0',
  'upgrade.premium.features.1',
  'upgrade.premium.features.2',
  'upgrade.premium.features.3',
  'upgrade.premium.features.4',
  'upgrade.premium.features.5',
];

const COMING_FEATURE_KEYS = [
  'upgrade.coming.features.0',
  'upgrade.coming.features.1',
  'upgrade.coming.features.2',
];

export default function UpgradeScreen() {
  const { t } = useTranslation('plans');
  const isPremium = useIsPremium();
  const userId = useAuthStore((s) => s.user?.id);
  const [billing, setBilling] = useState<Billing>('yearly');
  const [promoCode, setPromoCode] = useState('');
  const [promoOpen, setPromoOpen] = useState(false);

  const price = billing === 'monthly' ? t('upgrade.priceMonthly') : t('upgrade.priceYearly');
  const ctaLabel = billing === 'monthly' ? t('upgrade.ctaMonthly') : t('upgrade.ctaYearly');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Navbar */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 18, color: colors.text }}>
          {t('upgrade.navTitle')}
        </Text>
      </View>

      <Animated.ScrollView
        entering={FadeInUp.duration(250)}
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={{ alignItems: 'center', marginBottom: 28, gap: 8 }}>
          <Ionicons name="flash" size={40} color={colors.accent} />
          <Text
            style={{
              fontFamily: 'BebasNeue-Regular',
              fontSize: 30,
              color: colors.text,
              letterSpacing: 1,
            }}
          >
            {t('upgrade.heroTitle')}
          </Text>
          <Text
            style={{
              fontFamily: 'Inter-Regular',
              fontSize: 16,
              color: colors.textMuted,
              textAlign: 'center',
            }}
          >
            {t('upgrade.heroSubtitle')}
          </Text>
        </View>

        {/* Billing toggle */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 4,
            marginBottom: 8,
          }}
        >
          {(['monthly', 'yearly'] as const).map((b) => (
            <TouchableOpacity
              key={b}
              onPress={() => setBilling(b)}
              activeOpacity={0.7}
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: 'center',
                borderRadius: 10,
                backgroundColor: billing === b ? colors.primary : 'transparent',
              }}
            >
              <Text
                style={{
                  fontFamily: 'Inter-Bold',
                  fontSize: 14,
                  color: billing === b ? colors.background : colors.textMuted,
                }}
              >
                {b === 'monthly' ? t('upgrade.monthly') : t('upgrade.yearly')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ height: 20, justifyContent: 'center', marginBottom: 12 }}>
          {billing === 'yearly' && (
            <Text
              style={{
                fontFamily: 'Inter-Regular',
                fontSize: 13,
                color: colors.primary,
                textAlign: 'center',
              }}
            >
              {t('upgrade.yearlySavings')}
            </Text>
          )}
        </View>

        {/* Free tier card */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: 0.7,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 22, color: colors.text }}>
              {t('upgrade.free.title')}
            </Text>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 18, color: colors.text }}>
                {t('upgrade.free.price')}
              </Text>
              {!isPremium && <Badge label={t('upgrade.free.currentBadge')} variant="muted" />}
            </View>
          </View>
          {APRENDIZ_FEATURE_KEYS.map((f, i) => (
            <View
              key={i}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}
            >
              <Ionicons name="checkmark" size={14} color={colors.textMuted} />
              <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted }}>
                {t(f)}
              </Text>
            </View>
          ))}
        </View>

        {/* Premium tier card — incandescent border */}
        <LinearGradient
          colors={gradients.ember}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 18, padding: 2, marginBottom: 12 }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 16,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 12,
              }}
            >
              <View style={{ gap: 6 }}>
                <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 24, color: colors.text }}>
                  {t('upgrade.premium.title')}
                </Text>
                {billing === 'yearly' ? (
                  <Badge label={t('upgrade.premium.bestValueBadge')} variant="premium" />
                ) : (
                  <Badge label={t('upgrade.premium.recommendedBadge')} variant="primary" />
                )}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text
                  style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 18, color: colors.primary }}
                >
                  {price}
                </Text>
                {billing === 'yearly' && (
                  <Text
                    style={{
                      fontFamily: 'Inter-Regular',
                      fontSize: 11,
                      color: colors.textMuted,
                    }}
                  >
                    {t('upgrade.premium.yearlyBreakdown')}
                  </Text>
                )}
                {isPremium && <Badge label={t('upgrade.premium.activeBadge')} variant="accent" />}
              </View>
            </View>
            {MAESTRO_FEATURE_KEYS.map((f, i) => (
              <View
                key={i}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}
              >
                <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
                <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.text }}>
                  {t(f)}
                </Text>
              </View>
            ))}
            <Text
              style={{
                fontFamily: 'Inter-Bold',
                fontSize: 12,
                color: colors.accent,
                letterSpacing: 1,
                marginTop: 12,
                marginBottom: 6,
              }}
            >
              {t('upgrade.coming.title')}
            </Text>
            {COMING_FEATURE_KEYS.map((f, i) => (
              <View
                key={i}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}
              >
                <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted }}>
                  {t(f)}
                </Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* Promo code */}
        <TouchableOpacity
          onPress={() => setPromoOpen((v) => !v)}
          activeOpacity={0.7}
          style={{ alignItems: 'center', marginBottom: 12 }}
        >
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: colors.textMuted }}>
            {t('upgrade.promoQuestion')} {promoOpen ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>
        {promoOpen && (
          <Input
            value={promoCode}
            onChangeText={setPromoCode}
            placeholder={t('upgrade.promoPlaceholder')}
            autoCapitalize="characters"
            style={{ marginBottom: 20 }}
          />
        )}

        {/* CTA */}
        {isPremium ? (
          <View style={{ gap: 12 }}>
            <View
              style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}
            >
              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              <Text
                style={{ fontFamily: 'Inter-Bold', fontSize: 16, color: colors.primary }}
              >
                {t('upgrade.alreadyPremium')}
              </Text>
            </View>
            <Button
              variant="secondary"
              label={t('upgrade.manageSubscription')}
              onPress={() => userId && Linking.openURL(buildPortalURL(userId))}
            />
          </View>
        ) : (
          <Button
            label={ctaLabel}
            onPress={() => userId && Linking.openURL(buildPaymentURL(userId, billing, promoCode))}
          />
        )}

        {/* Legal footer */}
        <Text
          style={{
            fontFamily: 'Inter-Regular',
            fontSize: 12,
            color: colors.textMuted,
            textAlign: 'center',
            marginTop: 16,
          }}
        >
          {t('upgrade.legal')}
        </Text>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}
