import { useState } from 'react';
import { Text, TouchableOpacity, View, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useOnboardingStore } from '@/store/onboarding.store';
import { useProfileStore } from '@/store/profile.store';
import { SparkBurst } from '@/components/effects/SparkBurst';
import { useTheme } from '@/lib/theme';
import { typography } from '@/constants/typography';
import { BODY_AREAS, INJURY_SEVERITIES, MEDICAL_CONDITIONS, type BodyArea, type InjurySeverity, type MedicalConditionCode } from '@/constants/health';
import { Input } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Chip';
import { FieldLabel } from '@/components/ui/FieldLabel';

export default function Step6Health() {
  const { t } = useTranslation('onboarding');
  const { colors } = useTheme();
  const [bodyArea, setBodyArea] = useState<BodyArea | null>(null);
  const [severity, setSeverity] = useState<InjurySeverity | null>(null);
  const [injuryNotes, setInjuryNotes] = useState('');
  const [condition, setCondition] = useState<MedicalConditionCode | null>(null);
  const [conditionNotes, setConditionNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  const { user } = useAuthStore();
  const { reset } = useOnboardingStore();
  const { setOnboardingCompleted } = useProfileStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  async function finishOnboarding() {
    const { error } = await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user!.id);
    if (error) throw error;
    setCelebrating(true);
  }

  async function handleFinish() {
    if (!user) return;
    setLoading(true);
    try {
      if (bodyArea && severity) {
        const sanitized = injuryNotes.trim().slice(0, 200).replace(/[^\w\s,áéíóúñü.]/gi, '');
        const { error } = await supabase.from('injuries').insert({
          user_id: user.id, body_area: bodyArea, severity, notes: sanitized || null,
        });
        if (error) throw error;
      }
      if (condition) {
        const sanitized = conditionNotes.trim().slice(0, 200).replace(/[^\w\s,áéíóúñü.]/gi, '');
        const { error } = await supabase.from('medical_conditions').insert({
          user_id: user.id, condition, notes: sanitized || null,
        });
        if (error) throw error;
      }
      await finishOnboarding();
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : t('step6.errors.unknown');
      Alert.alert(t('step6.errors.saveFailed.title'), message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    setLoading(true);
    try {
      await finishOnboarding();
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : t('step6.errors.unknown');
      Alert.alert(t('step6.errors.saveFailed.title'), message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="pt-6 pb-8">
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.caption, color: colors.textMuted, marginBottom: 4 }}>
            {t('step6.eyebrow')}
          </Text>
          <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: typography.sizes.screenTitle, color: colors.text }}>
            {t('step6.title')}
          </Text>
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.body, color: colors.textMuted, marginTop: 8 }}>
            {t('step6.subtitle')}
          </Text>
        </View>

        <FieldLabel first>{t('step6.injuryQuestion')}</FieldLabel>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {BODY_AREAS.map((a) => (
            <Chip key={a.value} label={t(a.labelKey)} selected={bodyArea === a.value} onPress={() => setBodyArea(bodyArea === a.value ? null : a.value)} />
          ))}
        </View>
        {bodyArea ? (
          <>
            <FieldLabel>{t('step6.severityQuestion')}</FieldLabel>
            <View className="gap-2 mb-4">
              {INJURY_SEVERITIES.map((s) => {
                const isSelected = severity === s.value;
                return (
                  <TouchableOpacity
                    key={s.value}
                    onPress={() => setSeverity(s.value)}
                    className={`p-4 rounded-xl border ${isSelected ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
                  >
                    <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.bodySmall, color: isSelected ? colors.primary : colors.text }}>
                      {t(s.labelKey)}
                    </Text>
                    <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                      {t(s.descriptionKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Input placeholder={t('step6.injuryNotesPlaceholder')} value={injuryNotes} onChangeText={setInjuryNotes} multiline />
          </>
        ) : null}

        <FieldLabel>{t('step6.conditionQuestion')}</FieldLabel>
        <View className="flex-row flex-wrap gap-2 mb-3">
          {MEDICAL_CONDITIONS.map((c) => (
            <Chip key={c.value} tint="accent" label={t(c.labelKey)} selected={condition === c.value} onPress={() => setCondition(condition === c.value ? null : c.value)} />
          ))}
        </View>
        {condition ? (
          <Input placeholder={t('step6.conditionNotesPlaceholder')} value={conditionNotes} onChangeText={setConditionNotes} multiline />
        ) : null}

        <View className="mt-6 p-3 rounded-xl border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textMuted }}>
            {t('step6.safetyNote')}
          </Text>
        </View>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 px-5 bg-background border-t border-border gap-2"
        style={{ paddingBottom: insets.bottom + 16, paddingTop: 16 }}
      >
        <TouchableOpacity
          className="rounded-xl h-14 items-center justify-center bg-primary"
          onPress={handleFinish}
          disabled={loading || celebrating}
        >
          {loading ? <ActivityIndicator color={colors.background} /> : (
            <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.body, color: colors.background }}>
              {t('step6.finishButton')}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSkip} disabled={loading || celebrating} className="items-center py-2">
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.bodySmall, color: colors.textMuted }}>
            {t('step6.skipButton')}
          </Text>
        </TouchableOpacity>
      </View>

      <SparkBurst
        trigger={celebrating}
        onDone={() => {
          setOnboardingCompleted(true);
          reset();
          router.replace('/(app)');
        }}
      />
    </View>
  );
}
