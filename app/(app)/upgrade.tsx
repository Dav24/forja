import { useState } from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { VulcanoAvatar } from '@/components/chat/VulcanoAvatar';
import { useIsPremium } from '@/hooks/useSubscription';
import { useTheme } from '@/lib/theme';
import { useAuthStore } from '@/store/auth.store';
import { buildPaymentURL, buildPortalURL, type Billing } from '@/lib/payments';
import { PRICE_FREE, PRICE_MONTHLY, PRICE_YEARLY } from '@/constants/pricing';

const APRENDIZ_FEATURE_KEYS = [
  'upgrade.free.features.0',
  'upgrade.free.features.1',
  'upgrade.free.features.2',
  'upgrade.free.features.3',
  'upgrade.free.features.4',
];

// Las 4 celdas del bento reutilizan 4 de las 6 claves existentes de features premium
// (se dejan fuera 365-días-de-historial e "vulcano analiza tus datos" — esta última
// se re-narra en upgrade.premium.vulcanoTitle/vulcanoBody para la celda span-2).
const BENTO_FEATURE_KEYS = [
  'upgrade.premium.features.0',
  'upgrade.premium.features.1',
  'upgrade.premium.features.2',
  'upgrade.premium.features.4',
];

const COMING_FEATURE_KEYS = [
  'upgrade.coming.features.0',
  'upgrade.coming.features.1',
  'upgrade.coming.features.2',
];

export default function UpgradeScreen() {
  const { t } = useTranslation('plans');
  const { colors } = useTheme();
  const isPremium = useIsPremium();
  const userId = useAuthStore((s) => s.user?.id);
  const [billing, setBilling] = useState<Billing>('yearly');
  const [promoCode, setPromoCode] = useState('');
  const [promoOpen, setPromoOpen] = useState(false);

  const bentoCard = {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 14,
  };

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
        {/* ═══ Bento (grid 2 col, gap 11 — up-bento del prototipo) ═══ */}
        <View style={{ gap: 11 }}>
          {/* Celda hero — span 2, SIEMPRE oscura en ambos temas — decisión del prototipo v7.
              Todo hex hardcodeado dentro de esta celda (fondo, textos, badge, pill inactiva)
              está anclado a esa decisión: el hero no debe adaptarse al tema claro/oscuro. */}
          <View style={{ borderRadius: 20, overflow: 'hidden', paddingVertical: 19, paddingHorizontal: 18 }}>
            <LinearGradient
              colors={['#221610', '#150E09']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
            <LinearGradient
              colors={['rgba(251,191,36,0.25)', 'rgba(251,191,36,0)']}
              start={{ x: 1, y: 0 }}
              end={{ x: 0.3, y: 0.7 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />

            <Text
              style={{
                fontFamily: 'SpaceGrotesk-Bold',
                fontSize: 11,
                letterSpacing: 2.2,
                textTransform: 'uppercase',
                color: '#C9B8A8',
              }}
            >
              {t('upgrade.premium.eyebrow')}
            </Text>
            <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 34, color: '#FAF7F2', marginTop: 5 }}>
              {t('upgrade.premium.title')}
            </Text>

            {isPremium ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <Ionicons name="checkmark-circle" size={20} color="#FBBF24" />
                <Text style={{ fontFamily: 'Inter-Bold', fontSize: 15, color: '#FAF7F2' }}>
                  {t('upgrade.alreadyPremium')}
                </Text>
              </View>
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 10 }}>
                  <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 44, lineHeight: 44, color: '#FAF7F2' }}>
                    {billing === 'monthly' ? PRICE_MONTHLY : PRICE_YEARLY}
                  </Text>
                  <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 12, color: '#FAF7F2', opacity: 0.7 }}>
                    {billing === 'monthly' ? t('upgrade.premium.unitMonthly') : t('upgrade.premium.unitYearly')}
                  </Text>
                  {billing === 'yearly' && (
                    <View
                      style={{
                        backgroundColor: 'rgba(34,197,94,0.15)',
                        borderWidth: 1,
                        borderColor: 'rgba(34,197,94,0.3)',
                        borderRadius: 99,
                        paddingHorizontal: 9,
                        paddingVertical: 3,
                        marginLeft: 4,
                      }}
                    >
                      <Text style={{ fontFamily: 'Inter-Medium', fontSize: 10.5, color: '#22C55E' }}>
                        {t('upgrade.premium.saveBadge')}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Toggle Mensual/Anual — anual default */}
                <View
                  style={{
                    flexDirection: 'row',
                    backgroundColor: 'rgba(255,255,255,0.07)',
                    borderRadius: 12,
                    padding: 3,
                    gap: 3,
                    marginTop: 14,
                  }}
                >
                  {(['monthly', 'yearly'] as const).map((b) => (
                    <TouchableOpacity
                      key={b}
                      onPress={() => setBilling(b)}
                      activeOpacity={0.75}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        alignItems: 'center',
                        borderRadius: 10,
                        backgroundColor: billing === b ? colors.primary : 'transparent',
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: 'Inter-Medium',
                          fontSize: 12,
                          color: billing === b ? colors.onPrimary : 'rgba(250,247,242,0.65)',
                        }}
                      >
                        {b === 'monthly' ? t('upgrade.monthly') : t('upgrade.yearly')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>

          {/* 4 celdas de feature — check + título bold */}
          <View style={{ flexDirection: 'row', gap: 11 }}>
            {BENTO_FEATURE_KEYS.slice(0, 2).map((key) => (
              <View key={key} style={[bentoCard, { flex: 1 }]}>
                <View style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start' }}>
                  <Ionicons name="checkmark" size={15} color={colors.primary} style={{ marginTop: 1 }} />
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: 'SpaceGrotesk-Bold',
                      fontSize: 12.5,
                      lineHeight: 17,
                      color: colors.text,
                    }}
                  >
                    {t(key)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 11 }}>
            {BENTO_FEATURE_KEYS.slice(2, 4).map((key) => (
              <View key={key} style={[bentoCard, { flex: 1 }]}>
                <View style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start' }}>
                  <Ionicons name="checkmark" size={15} color={colors.primary} style={{ marginTop: 1 }} />
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: 'SpaceGrotesk-Bold',
                      fontSize: 12.5,
                      lineHeight: 17,
                      color: colors.text,
                    }}
                  >
                    {t(key)}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Celda Vulcano — span 2 */}
          <View style={[bentoCard, { flexDirection: 'row', gap: 12, alignItems: 'center' }]}>
            <VulcanoAvatar size={44} state="forge" />
            <Text
              style={{
                flex: 1,
                fontFamily: 'Inter-Regular',
                fontSize: 12.5,
                lineHeight: 18,
                color: colors.text,
              }}
            >
              <Text style={{ fontFamily: 'SpaceGrotesk-Bold' }}>{t('upgrade.premium.vulcanoTitle')}</Text>
              {' — ' + t('upgrade.premium.vulcanoBody')}
            </Text>
          </View>
        </View>

        {/* Promo code */}
        <TouchableOpacity
          onPress={() => setPromoOpen((v) => !v)}
          activeOpacity={0.7}
          style={{ alignItems: 'center', marginTop: 16, marginBottom: 12 }}
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
          <Button
            variant="secondary"
            label={t('upgrade.manageSubscription')}
            onPress={() => userId && Linking.openURL(buildPortalURL(userId))}
          />
        ) : (
          <Button
            label={t('upgrade.ctaBecome')}
            onPress={() => userId && Linking.openURL(buildPaymentURL(userId, billing, promoCode))}
          />
        )}

        {/* Legal footer */}
        <Text
          style={{
            fontFamily: 'JetBrainsMono-Medium',
            fontSize: 10.5,
            color: colors.textMuted,
            textAlign: 'center',
            marginTop: 10,
          }}
        >
          {t('upgrade.legal')}
        </Text>

        {/* ═══ Tier Aprendiz + EN CAMINO — conservados debajo del bento (funnel de conversión) ═══ */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            marginTop: 28,
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
                {t('upgrade.free.price', { price: PRICE_FREE })}
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

        <View style={{ marginTop: 20 }}>
          <Text
            style={{
              fontFamily: 'Inter-Bold',
              fontSize: 12,
              color: colors.accent,
              letterSpacing: 1,
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
      </Animated.ScrollView>
    </SafeAreaView>
  );
}
