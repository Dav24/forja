import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useLogBodyData, useUpdateBodyData } from '@/hooks/useBodyTracking';
import { useIsPremium } from '@/hooks/useSubscription';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { UpgradeSheet } from '@/components/premium/UpgradeSheet';

interface MeasurementFormProps {
  initialValues?: {
    weight_kg?: number;
    body_fat_pct?: number;
    muscle_mass_kg?: number;
  };
  isUpdate?: boolean;
  existingId?: string;
  onSuccess: () => void;
}

export function MeasurementForm({ initialValues, isUpdate = false, existingId, onSuccess }: MeasurementFormProps) {
  const { t } = useTranslation('progress');
  const isPremium = useIsPremium();
  const { mutate, isPending: insertPending, error: insertError } = useLogBodyData();
  const { mutate: updateBody, isPending: isUpdating, error: updateError } = useUpdateBodyData();
  const isPending = insertPending || isUpdating;
  const error = insertError || updateError;
  const upgradeSheetRef = useRef<any>(null);

  const [weightKg, setWeightKg] = useState(initialValues?.weight_kg?.toString() ?? '');
  const [bodyFatPct, setBodyFatPct] = useState(initialValues?.body_fat_pct?.toString() ?? '');
  const [muscleMassKg, setMuscleMassKg] = useState(initialValues?.muscle_mass_kg?.toString() ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);

  function validate(): string | null {
    const w = parseFloat(weightKg);
    if (!weightKg || isNaN(w) || w < 20 || w > 300) return t('form.weightError');
    if (isPremium && bodyFatPct) {
      const bf = parseFloat(bodyFatPct);
      if (isNaN(bf) || bf < 2 || bf > 60) return t('form.fatError');
    }
    if (isPremium && muscleMassKg) {
      const mm = parseFloat(muscleMassKg);
      if (isNaN(mm) || mm < 10 || mm > 150) return t('form.muscleError');
    }
    return null;
  }

  function handleSubmit() {
    const err = validate();
    if (err) { setValidationError(err); return; }
    setValidationError(null);

    if (existingId) {
      const params: { id: string; weight_kg: number; body_fat_pct?: number; muscle_mass_kg?: number } = {
        id: existingId,
        weight_kg: parseFloat(weightKg),
      };
      if (isPremium && bodyFatPct) params.body_fat_pct = parseFloat(bodyFatPct);
      if (isPremium && muscleMassKg) params.muscle_mass_kg = parseFloat(muscleMassKg);
      updateBody(params, { onSuccess });
    } else {
      const entry: { weight_kg: number; body_fat_pct?: number; muscle_mass_kg?: number } = {
        weight_kg: parseFloat(weightKg),
      };
      if (isPremium && bodyFatPct) entry.body_fat_pct = parseFloat(bodyFatPct);
      if (isPremium && muscleMassKg) entry.muscle_mass_kg = parseFloat(muscleMassKg);
      mutate(entry, { onSuccess });
    }
  }

  return (
    <View className="gap-4">
      <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: typography.sizes.h3, color: colors.text }}>
        {isUpdate ? t('form.titleUpdate') : t('form.titleCreate')}
      </Text>

      <Input
        label={t('form.weightLabel')}
        value={weightKg}
        onChangeText={setWeightKg}
        placeholder="70.5"
        keyboardType="decimal-pad"
      />

      <View className="gap-1.5">
        <View className="flex-row items-center justify-between">
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: 14, color: colors.text }}>
            {t('form.fatLabel')}
          </Text>
          {!isPremium && <Badge label={t('form.premiumBadge')} variant="accent" />}
        </View>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => { if (!isPremium) upgradeSheetRef.current?.expand(); }}
        >
          <Input
            value={bodyFatPct}
            onChangeText={setBodyFatPct}
            placeholder="18.5"
            keyboardType="decimal-pad"
            editable={isPremium}
            style={{ opacity: isPremium ? 1 : 0.4 }}
          />
        </TouchableOpacity>
      </View>

      <View className="gap-1.5">
        <View className="flex-row items-center justify-between">
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: 14, color: colors.text }}>
            {t('form.muscleLabel')}
          </Text>
          {!isPremium && <Badge label={t('form.premiumBadge')} variant="accent" />}
        </View>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => { if (!isPremium) upgradeSheetRef.current?.expand(); }}
        >
          <Input
            value={muscleMassKg}
            onChangeText={setMuscleMassKg}
            placeholder="35.0"
            keyboardType="decimal-pad"
            editable={isPremium}
            style={{ opacity: isPremium ? 1 : 0.4 }}
          />
        </TouchableOpacity>
      </View>

      {(validationError || error) && (
        <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.destructive }}>
          {validationError ?? t('form.saveError')}
        </Text>
      )}

      <Button
        label={isUpdate ? t('form.submitUpdate') : t('form.submitCreate')}
        onPress={handleSubmit}
        loading={isPending}
        disabled={!weightKg}
      />
      <UpgradeSheet ref={upgradeSheetRef} context="body_composition" />
    </View>
  );
}
