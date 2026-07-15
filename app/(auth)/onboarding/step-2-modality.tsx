import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useOnboardingStore } from '@/store/onboarding.store';
import { useTheme } from '@/lib/theme';
import { typography } from '@/constants/typography';
import { MODALITIES, type ModalityId } from '@/constants/modalities';
import { Input } from '@/components/ui/Input';
import { ModalityOrientationPicker } from '@/components/goals/ModalityOrientationPicker';

export default function Step2Modality() {
  const { t } = useTranslation('onboarding');
  const { colors } = useTheme();
  const [principal, setPrincipal] = useState<ModalityId | null>(null);
  const [secondary, setSecondary] = useState<ModalityId[]>([]);
  const [sportType, setSportType] = useState('');
  const [orientation, setOrientation] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [secondaryNotes, setSecondaryNotes] = useState('');
  const { setStep2Modality } = useOnboardingStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const needsSport = principal === 'ball_sports' || secondary.includes('ball_sports');

  function selectPrincipal(id: ModalityId) {
    setPrincipal(id);
    setSecondary((prev) => prev.filter((s) => s !== id));
    setOrientation(null);
    setNotes('');
  }

  function toggleSecondary(id: ModalityId) {
    setSecondary((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  }

  function sanitize(v: string) {
    return v.trim().slice(0, 200).replace(/[^\w\s,áéíóúñü.]/gi, '');
  }

  function handleContinue() {
    if (!principal) return;
    setStep2Modality({
      modality: principal,
      secondaryModalities: secondary,
      sportType: needsSport && sportType.trim() ? sportType.trim() : null,
      modalityOrientation: orientation,
      modalityGoalNotes: notes.trim() ? sanitize(notes) : null,
      secondaryGoalNotes: secondary.length > 0 && secondaryNotes.trim() ? sanitize(secondaryNotes) : null,
    });
    router.push('/(auth)/onboarding/step-3-body');
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="pt-6 pb-8">
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.caption, color: colors.textMuted, marginBottom: 4 }}>
            {t('layout.stepOf', { current: 2, total: 5 })}
          </Text>
          <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: typography.sizes.screenTitle, color: colors.text }}>
            {t('step2.title')}
          </Text>
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.body, color: colors.textMuted, marginTop: 8 }}>
            {t('step2.subtitle')}
          </Text>
        </View>

        <View className="gap-3">
          {MODALITIES.map((m) => {
            const isSelected = principal === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                onPress={() => selectPrincipal(m.id)}
                className={`rounded-2xl p-4 border ${isSelected ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
                activeOpacity={0.7}
              >
                <View className="flex-row items-center gap-4">
                  <View style={{
                    width: 44, height: 44, borderRadius: 22,
                    backgroundColor: isSelected ? colors.primary : colors.surfaceElevated,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name={m.iconName} size={22} color={isSelected ? colors.background : colors.primary} />
                  </View>
                  <View className="flex-1">
                    <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.body, color: isSelected ? colors.primary : colors.text }}>
                      {t(m.labelKey)}
                    </Text>
                    <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.caption, color: colors.textMuted, marginTop: 2 }}>
                      {t(m.descriptionKey)}
                    </Text>
                  </View>
                  {isSelected && (
                    <View className="w-6 h-6 rounded-full bg-primary items-center justify-center">
                      <Ionicons name="checkmark" size={14} color={colors.background} />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {principal && (
          <View className="mt-6">
            <ModalityOrientationPicker
              modality={principal}
              orientation={orientation}
              onChangeOrientation={setOrientation}
              notes={notes}
              onChangeNotes={setNotes}
              showEditableHint
            />
          </View>
        )}

        {principal && (
          <View className="mt-8">
            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, color: colors.text }}>
              {t('step2.secondaryTitle')}
            </Text>
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.caption, color: colors.textMuted, marginTop: 4, marginBottom: 12 }}>
              {t('step2.secondarySubtitle')}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {MODALITIES.filter((m) => m.id !== principal).map((m) => {
                const on = secondary.includes(m.id);
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => toggleSecondary(m.id)}
                    className={`flex-row items-center gap-1.5 rounded-full px-4 py-2 border ${on ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={m.iconName} size={14} color={on ? colors.primary : colors.textMuted} />
                    <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.bodySmall, color: on ? colors.primary : colors.text }}>
                      {t(m.labelKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {secondary.length > 0 && (
              <View className="mt-4">
                <Input
                  placeholder={t('step2.secondaryNotesPlaceholder')}
                  value={secondaryNotes}
                  onChangeText={setSecondaryNotes}
                />
              </View>
            )}
          </View>
        )}

        {needsSport && (
          <View className="mt-6">
            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, color: colors.text, marginBottom: 8 }}>
              {t('step2.sportLabel')}
            </Text>
            <Input placeholder={t('step2.sportPlaceholder')} value={sportType} onChangeText={setSportType} />
          </View>
        )}
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 px-5 bg-background border-t border-border"
        style={{ paddingBottom: insets.bottom + 16, paddingTop: 16 }}
      >
        <TouchableOpacity
          className={`rounded-xl h-14 items-center justify-center ${principal ? 'bg-primary' : 'bg-surface'}`}
          onPress={handleContinue}
          disabled={!principal}
        >
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.body, color: principal ? colors.background : colors.textMuted }}>
            {t('layout.continue')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
