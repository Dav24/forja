import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useActiveGoal, useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { useLatestBodyData } from '@/hooks/useBodyTracking';
import { GOALS, FITNESS_LEVELS, MODES, ATHLETIC_BACKGROUNDS, SUPPLEMENTS, type GoalType, type FitnessLevel, type TrainingMode, type AthleticBackground, type SupplementCode } from '@/constants/goals';
import { MODALITIES, type ModalityId } from '@/constants/modalities';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Chip';
import { StaggerIn } from '@/components/ui/StaggerIn';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { GroupCard } from '@/components/ui/GroupCard';
import { useTheme } from '@/lib/theme';
import { TargetWeightPicker } from '@/components/goals/TargetWeightPicker';
import { ModalityOrientationPicker } from '@/components/goals/ModalityOrientationPicker';
import { checkWeightGoalSafety, type GoalTypeForWeight } from '@/lib/weightGoalSafety';

type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
const GENDERS: { value: Gender; labelKey: string }[] = [
  { value: 'male', labelKey: 'training.genderMale' },
  { value: 'female', labelKey: 'training.genderFemale' },
  { value: 'other', labelKey: 'training.genderOther' },
  { value: 'prefer_not_to_say', labelKey: 'training.genderPreferNotToSay' },
];

export default function TrainingScreen() {
  const { t } = useTranslation('settings');
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const { data: goal } = useActiveGoal();
  const { data: latestBody } = useLatestBodyData();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const queryClient = useQueryClient();

  const [goalType, setGoalType] = useState<GoalType | null>(null);
  const [level, setLevel] = useState<FitnessLevel | null>(null);
  const [mode, setMode] = useState<TrainingMode | null>(null);
  const [modality, setModality] = useState<ModalityId | null>(null);
  const [secondary, setSecondary] = useState<ModalityId[]>([]);
  const [sportType, setSportType] = useState('');
  const [targetWeightInput, setTargetWeightInput] = useState('');
  const [targetDate, setTargetDate] = useState<string | null>(null);
  const [modalityOrientation, setModalityOrientation] = useState<string | null>(null);
  const [modalityGoalNotes, setModalityGoalNotes] = useState('');
  const [secondaryGoalNotes, setSecondaryGoalNotes] = useState('');
  const [background, setBackground] = useState<AthleticBackground | null>(null);
  const [supplements, setSupplements] = useState<SupplementCode[]>([]);
  const [supplementsOther, setSupplementsOther] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Precargar valores actuales una sola vez
  useEffect(() => {
    if (loaded || goal === undefined || latestBody === undefined || profile === undefined) return;
    if (goal) {
      setGoalType(goal.type as GoalType);
      setLevel(goal.fitness_level as FitnessLevel);
      setMode(goal.mode as TrainingMode);
      setModality((goal.modality as ModalityId) ?? null);
      setSecondary((goal.secondary_modalities as ModalityId[]) ?? []);
      setSportType(goal.sport_type ?? '');
      setBackground((goal.athletic_background as AthleticBackground) ?? null);
      setTargetWeightInput(goal.target_weight_kg != null ? String(goal.target_weight_kg) : '');
      setTargetDate(goal.target_date ?? null);
      setModalityOrientation(goal.modality_orientation ?? null);
      setModalityGoalNotes(goal.modality_goal_notes ?? '');
      setSecondaryGoalNotes(goal.secondary_goal_notes ?? '');
    }
    if (profile) {
      setSupplements((profile.supplements as SupplementCode[]) ?? []);
      setSupplementsOther(profile.supplements_other ?? '');
    }
    if (latestBody) {
      if (latestBody.height_cm) setHeightCm(String(latestBody.height_cm));
      if (latestBody.age) setAge(String(latestBody.age));
      if (latestBody.gender) setGender(latestBody.gender as Gender);
    }
    setLoaded(true);
  }, [goal, latestBody, profile, loaded]);

  const needsSport = modality === 'ball_sports' || secondary.includes('ball_sports');
  const valid = !!goalType && !!level && !!mode && !!modality;

  function toggleSecondary(id: ModalityId) {
    setSecondary((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  }

  function toggleSupplement(value: SupplementCode) {
    setSupplements((prev) => {
      if (value === 'none') return prev.includes('none') ? [] : ['none'];
      const without = prev.filter((s) => s !== 'none');
      return without.includes(value) ? without.filter((s) => s !== value) : [...without, value];
    });
  }

  async function handleSave() {
    if (!user || !valid) return;

    // Validar campos numéricos ANTES de cualquier escritura
    const heightNum = heightCm.trim() ? Number(heightCm.trim().replace(',', '.')) : null;
    const ageNum = age.trim() ? Number.parseInt(age.trim(), 10) : null;
    if ((heightNum !== null && !Number.isFinite(heightNum)) || (ageNum !== null && !Number.isFinite(ageNum))) {
      Alert.alert(t('training.invalidNumbersTitle'), t('training.invalidNumbersBody'));
      return;
    }

    const showsWeightTarget = goalType === 'weight_loss' || goalType === 'muscle_gain';
    const parsedTargetWeight = showsWeightTarget && targetWeightInput.trim()
      ? Number(targetWeightInput.trim().replace(',', '.'))
      : null;
    const targetWeightNum = parsedTargetWeight !== null && Number.isFinite(parsedTargetWeight) ? parsedTargetWeight : null;
    if (showsWeightTarget && targetWeightNum != null && targetDate) {
      if (latestBody?.weight_kg == null) {
        Alert.alert(t('training.noBodyDataTitle'), t('training.noBodyDataBody'));
        return;
      }
      const check = checkWeightGoalSafety({
        goalType: goalType as GoalTypeForWeight,
        currentWeightKg: Number(latestBody.weight_kg),
        targetWeightKg: targetWeightNum,
        targetDate,
      });
      if (!check.valid) {
        if (check.reasonKey === 'wrongDirection') {
          Alert.alert(t('training.wrongDirectionGoalTitle'), t('training.wrongDirectionGoalBody'));
        } else {
          Alert.alert(
            t('training.unsafeGoalRateTitle'),
            t('training.unsafeGoalRateBody', {
              rate: check.rateKgPerWeek?.toFixed(2),
              maxRate: check.maxSafeRateKgPerWeek?.toFixed(2),
            }),
          );
        }
        return;
      }
    }

    setSaving(true);
    try {
      // 1. Desactivar goal(s) activo(s) — conserva historial
      const { error: deactErr } = await supabase
        .from('goals')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('is_active', true);
      if (deactErr) throw deactErr;

      // 2. Insertar goal nuevo activo (conserva target del anterior si existía)
      function sanitize(v: string) { return v.trim().slice(0, 200).replace(/[^\w\s,áéíóúñü.]/gi, ''); }
      const { error: goalErr } = await supabase.from('goals').insert({
        user_id: user.id,
        type: goalType,
        target_weight_kg: targetWeightNum,
        target_date: showsWeightTarget ? targetDate : null,
        fitness_level: level,
        mode,
        modality,
        secondary_modalities: secondary,
        sport_type: needsSport && sportType.trim() ? sportType.trim() : null,
        athletic_background: background,
        modality_orientation: modalityOrientation,
        modality_goal_notes: modalityGoalNotes.trim() ? sanitize(modalityGoalNotes) : null,
        secondary_goal_notes: secondary.length > 0 && secondaryGoalNotes.trim() ? sanitize(secondaryGoalNotes) : null,
      });
      if (goalErr) {
        // Best-effort: reactivar el goal anterior para no dejar al usuario sin goal activo
        if (goal?.id) {
          await supabase.from('goals').update({ is_active: true }).eq('id', goal.id);
        }
        throw goalErr;
      }

      // 3. Atributos corporales: UPDATE del último registro (INSERT si no hay)
      const bodyPatch = {
        height_cm: heightNum,
        age: ageNum,
        gender,
      };
      if (latestBody?.id) {
        const { error: bodyErr } = await supabase.from('body_data').update(bodyPatch).eq('id', latestBody.id);
        if (bodyErr) throw bodyErr;
      } else if (bodyPatch.height_cm || bodyPatch.age || bodyPatch.gender) {
        const { error: bodyErr } = await supabase.from('body_data').insert({ user_id: user.id, ...bodyPatch });
        if (bodyErr) throw bodyErr;
      }

      // 4. Suplementación: UPDATE del perfil
      const supplementsOtherTrimmed = supplementsOther.trim().slice(0, 200).replace(/[^\w\s,áéíóúñü.]/gi, '');
      await new Promise<void>((resolve, reject) => {
        updateProfile.mutate(
          { supplements, supplements_other: supplementsOtherTrimmed || null },
          { onSuccess: () => resolve(), onError: (e) => reject(e) },
        );
      });

      queryClient.invalidateQueries({ queryKey: ['goal'] });
      queryClient.invalidateQueries({ queryKey: ['body_data'] });
      queryClient.invalidateQueries({ queryKey: ['profile-stats'] });
      Alert.alert(t('training.savedTitle'), t('training.savedBody'));
      router.back();
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : t('training.unknownError');
      Alert.alert(t('training.saveErrorTitle'), message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.text, letterSpacing: 1 }}>
          {t('training.title')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <StaggerIn index={0}>
          <GroupCard title={t('training.groupProfileTitle')} iconName="flame-outline">
            <FieldLabel first>{t('training.goal')}</FieldLabel>
            <View className="flex-row flex-wrap gap-2">
              {GOALS.map((g) => (
                <Chip key={g.type} selected={goalType === g.type} iconName={g.iconName} label={t(g.titleKey)} onPress={() => setGoalType(g.type)} />
              ))}
            </View>

            <FieldLabel>{t('training.level')}</FieldLabel>
            <View className="flex-row flex-wrap gap-2">
              {FITNESS_LEVELS.map((l) => (
                <Chip key={l.value} selected={level === l.value} label={t(l.labelKey)} onPress={() => setLevel(l.value)} />
              ))}
            </View>

            <FieldLabel>{t('training.mode')}</FieldLabel>
            <View className="flex-row flex-wrap gap-2">
              {MODES.map((m) => (
                <Chip key={m.value} selected={mode === m.value} iconName={m.iconName} label={t(m.labelKey)} onPress={() => setMode(m.value)} />
              ))}
            </View>

            {(goalType === 'weight_loss' || goalType === 'muscle_gain') && (
              <>
                <FieldLabel>{t('training.targetWeightSectionLabel')}</FieldLabel>
                <TargetWeightPicker
                  weightValue={targetWeightInput}
                  onChangeWeight={setTargetWeightInput}
                  targetDate={targetDate}
                  onChangeTargetDate={setTargetDate}
                />
              </>
            )}
          </GroupCard>
        </StaggerIn>

        <StaggerIn index={1}>
          <GroupCard title={t('training.groupDisciplineTitle')} iconName="barbell-outline">
            <FieldLabel first>{t('training.primaryModality')}</FieldLabel>
            <View className="flex-row flex-wrap gap-2">
              {MODALITIES.map((m) => (
                <Chip
                  key={m.id}
                  selected={modality === m.id}
                  iconName={m.iconName}
                  label={t(m.labelKey)}
                  onPress={() => {
                    setModality(m.id);
                    setSecondary((prev) => prev.filter((s) => s !== m.id));
                    setModalityOrientation(null);
                    setModalityGoalNotes('');
                  }}
                />
              ))}
            </View>

            <FieldLabel>{t('training.secondaryModalities')}</FieldLabel>
            <View className="flex-row flex-wrap gap-2">
              {MODALITIES.filter((m) => m.id !== modality).map((m) => (
                <Chip key={m.id} selected={secondary.includes(m.id)} iconName={m.iconName} label={t(m.labelKey)} onPress={() => toggleSecondary(m.id)} />
              ))}
            </View>

            {needsSport ? (
              <View className="mt-4">
                <Text className="mb-2" style={{ fontFamily: 'Inter-Medium', fontSize: 14, color: colors.text }}>{t('training.whatSport')}</Text>
                <Input placeholder={t('training.sportPlaceholder')} value={sportType} onChangeText={setSportType} />
              </View>
            ) : null}

            {modality && (
              <View className="mt-4">
                <ModalityOrientationPicker
                  modality={modality}
                  orientation={modalityOrientation}
                  onChangeOrientation={setModalityOrientation}
                  notes={modalityGoalNotes}
                  onChangeNotes={setModalityGoalNotes}
                />
              </View>
            )}
            {secondary.length > 0 && (
              <View className="mt-4">
                <Input
                  placeholder={t('training.secondaryNotesPlaceholder')}
                  value={secondaryGoalNotes}
                  onChangeText={setSecondaryGoalNotes}
                />
              </View>
            )}
          </GroupCard>
        </StaggerIn>

        <StaggerIn index={2}>
          <GroupCard title={t('training.basicData')} iconName="body-outline">
            <View className="gap-3">
              <Input label={t('training.heightLabel')} placeholder={t('training.heightPlaceholder')} value={heightCm} onChangeText={setHeightCm} keyboardType="numeric" />
              <Input label={t('training.ageLabel')} placeholder={t('training.agePlaceholder')} value={age} onChangeText={setAge} keyboardType="numeric" />
            </View>
            <View className="flex-row flex-wrap gap-2 mt-4">
              {GENDERS.map((g) => (
                <Chip key={g.value} selected={gender === g.value} label={t(g.labelKey)} onPress={() => setGender(g.value)} />
              ))}
            </View>
          </GroupCard>
        </StaggerIn>

        <StaggerIn index={3}>
          <GroupCard title={t('training.groupBackgroundTitle')} iconName="trophy-outline">
            <FieldLabel first>{t('training.athleticBackground')}</FieldLabel>
            <View className="flex-row flex-wrap gap-2">
              {ATHLETIC_BACKGROUNDS.map((b) => (
                <Chip key={b.value} selected={background === b.value} label={t(b.labelKey)} onPress={() => setBackground(b.value)} />
              ))}
            </View>

            <FieldLabel>{t('training.supplements')}</FieldLabel>
            <View className="flex-row flex-wrap gap-2 mb-2">
              {SUPPLEMENTS.map((s) => (
                <Chip key={s.value} selected={supplements.includes(s.value)} label={t(s.labelKey)} onPress={() => toggleSupplement(s.value)} />
              ))}
            </View>
            {!supplements.includes('none') ? (
              <Input placeholder={t('training.supplementsOtherPlaceholder')} value={supplementsOther} onChangeText={setSupplementsOther} />
            ) : null}
          </GroupCard>
        </StaggerIn>

        <View className="mt-2 gap-2">
          <Button label={t('training.save')} loading={saving} disabled={!valid} onPress={handleSave} />
          <Text className="text-center" style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textMuted }}>
            {t('training.saveHint')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
