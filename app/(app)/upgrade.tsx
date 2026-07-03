import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { useIsPremium } from '@/hooks/useSubscription';
import { colors, gradients } from '@/constants/colors';

type Billing = 'monthly' | 'yearly';

const FREE_FEATURES = [
  '20 mensajes al día con Vulcano',
  '1 plan de entrenamiento al mes',
  '1 plan alimenticio (de por vida)',
  '14 días de historial corporal',
];

const PREMIUM_FEATURES = [
  'Chat ilimitado con Vulcano',
  'Planes de entrenamiento ilimitados',
  '10 planes alimenticios al mes',
  '365 días de historial corporal',
  'Composición corporal (% grasa, músculo)',
  'Vulcano analiza tus datos de actividad',
];

const PRO_FEATURES = [
  'Todo lo de Premium',
  'Fotos de comida con análisis IA',
  'Análisis de técnica de ejercicio',
  'Coaching en tiempo real',
];

function buildPaymentURL(billing: Billing, promoCode: string): string {
  let url = 'https://pay.forja.fit?plan=premium&billing=' + billing;
  if (promoCode.trim()) {
    url += '&promo=' + encodeURIComponent(promoCode.trim().toUpperCase());
  }
  return url;
}

export default function UpgradeScreen() {
  const isPremium = useIsPremium();
  const [billing, setBilling] = useState<Billing>('yearly');
  const [promoCode, setPromoCode] = useState('');
  const [promoOpen, setPromoOpen] = useState(false);

  const price = billing === 'monthly' ? '$179 MXN/mes' : '$1,299 MXN/año';
  const ctaLabel = billing === 'monthly' ? 'Continuar — $179/mes' : 'Continuar — $1,299/año';

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
          Planes
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
            FORJA PRO
          </Text>
          <Text
            style={{
              fontFamily: 'Inter-Regular',
              fontSize: 16,
              color: colors.textMuted,
              textAlign: 'center',
            }}
          >
            Entrena con inteligencia
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
                {b === 'monthly' ? 'Mensual' : 'Anual'}
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
              Ahorras 40% con el plan anual
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
              Free
            </Text>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 18, color: colors.text }}>
                $0
              </Text>
              {!isPremium && <Badge label="Actual" variant="muted" />}
            </View>
          </View>
          {FREE_FEATURES.map((f, i) => (
            <View
              key={i}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}
            >
              <Ionicons name="checkmark" size={14} color={colors.textMuted} />
              <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted }}>
                {f}
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
                  ⚡ PREMIUM
                </Text>
                {billing === 'yearly' ? (
                  <Badge label="MEJOR VALOR" variant="premium" />
                ) : (
                  <Badge label="Recomendado" variant="primary" />
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
                    $108/mes — 40% off
                  </Text>
                )}
                {isPremium && <Badge label="✓ Activo" variant="accent" />}
              </View>
            </View>
            {PREMIUM_FEATURES.map((f, i) => (
              <View
                key={i}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}
              >
                <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
                <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.text }}>
                  {f}
                </Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* Pro tier card */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            marginBottom: 24,
            borderWidth: 1,
            borderColor: colors.textMuted,
            opacity: 0.6,
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
              🔥 Pro
            </Text>
            <Badge label="Próximamente" variant="muted" />
          </View>
          {PRO_FEATURES.map((f, i) => (
            <View
              key={i}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}
            >
              <Ionicons name="checkmark" size={14} color={colors.textMuted} />
              <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted }}>
                {f}
              </Text>
            </View>
          ))}
        </View>

        {/* Promo code */}
        <TouchableOpacity
          onPress={() => setPromoOpen((v) => !v)}
          activeOpacity={0.7}
          style={{ alignItems: 'center', marginBottom: 12 }}
        >
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: colors.textMuted }}>
            ¿Tienes un código? {promoOpen ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>
        {promoOpen && (
          <Input
            value={promoCode}
            onChangeText={setPromoCode}
            placeholder="FORJA2024"
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
                Ya eres Premium
              </Text>
            </View>
            <Button
              variant="secondary"
              label="Gestionar suscripción"
              onPress={() => Linking.openURL('https://pay.forja.fit/portal')}
            />
          </View>
        ) : (
          <Button
            label={ctaLabel}
            onPress={() => Linking.openURL(buildPaymentURL(billing, promoCode))}
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
          Cancela cuando quieras · Procesado de forma segura con Stripe
        </Text>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}
