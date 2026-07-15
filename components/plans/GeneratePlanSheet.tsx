import { forwardRef, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/ui/Sheet';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { MODALITIES, type ModalityId } from '@/constants/modalities';
import { useActiveGoal } from '@/hooks/useProfile';
import { useTheme } from '@/lib/theme';
import type { GeneratePlanParams } from '@/hooks/useWorkoutPlan';

interface Props {
  onGenerate: (params: GeneratePlanParams) => void;
}

const DAYS = [3, 4, 5, 6];
const MINUTES = [30, 45, 60, 90];

export const GeneratePlanSheet = forwardRef<BottomSheet, Props>(function GeneratePlanSheet(
  { onGenerate },
  ref,
) {
  const { t } = useTranslation('plans');
  const { colors } = useTheme();
  const { data: goal } = useActiveGoal();
  const [modality, setModality] = useState<ModalityId | null>(null);
  const [days, setDays] = useState(4);
  const [minutes, setMinutes] = useState(60);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [customEquipment, setCustomEquipment] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  // Pre-cargar la modalidad del goal activo cuando llegue
  const goalModality = (goal as { modality?: string | null } | null)?.modality as ModalityId | undefined;
  useEffect(() => {
    if (goalModality && !modality) setModality(goalModality);
  }, [goalModality]);

  // equipmentPresets son claves i18n — se resuelven con t() al mostrar y al enviar
  const presets = MODALITIES.find((m) => m.id === modality)?.equipmentPresets ?? [];
  const selectedPresetKey = equipment ?? presets[0];
  const resolvedEquipment = showCustom
    ? customEquipment.trim()
    : selectedPresetKey
      ? t(selectedPresetKey)
      : '';
  const canSubmit = !!modality && resolvedEquipment.length > 0;

  function selectModality(id: ModalityId) {
    setModality(id);
    setEquipment(null);
    setShowCustom(false);
    setCustomEquipment('');
  }

  return (
    <Sheet ref={ref} snapPoints={['85%']} scrollable>
      <View className="flex-row items-center gap-3 mb-5">
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryDim, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="hammer-outline" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text className="text-text font-bold text-2xl">{t('generateSheet.title')}</Text>
          <Text className="text-text-muted text-sm mt-0.5">{t('generateSheet.subtitle')}</Text>
        </View>
      </View>

      <FieldLabel first>{t('generateSheet.discipline')}</FieldLabel>
      <View className="flex-row flex-wrap gap-2 mb-1">
        {MODALITIES.map((m) => (
          <Chip key={m.id} label={t(m.labelKey)} iconName={m.iconName} selected={modality === m.id} onPress={() => selectModality(m.id)} />
        ))}
      </View>

      <View className="flex-row gap-4 mt-1">
        <View style={{ flex: 1 }}>
          <FieldLabel>{t('generateSheet.daysPerWeek')}</FieldLabel>
          <View className="flex-row flex-wrap gap-2">
            {DAYS.map((d) => (
              <Chip key={d} label={`${d}`} selected={days === d} onPress={() => setDays(d)} />
            ))}
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <FieldLabel>{t('generateSheet.minutesPerSession')}</FieldLabel>
          <View className="flex-row flex-wrap gap-2">
            {MINUTES.map((m) => (
              <Chip key={m} label={`${m}`} selected={minutes === m} onPress={() => setMinutes(m)} />
            ))}
          </View>
        </View>
      </View>

      {modality && (
        <>
          <FieldLabel>{t('generateSheet.equipment')}</FieldLabel>
          <View className="flex-row flex-wrap gap-2 mb-3">
            {presets.map((p) => (
              <Chip
                key={p}
                label={t(p)}
                selected={!showCustom && (equipment ?? presets[0]) === p}
                onPress={() => { setEquipment(p); setShowCustom(false); }}
              />
            ))}
            <Chip label={t('generateSheet.other')} selected={showCustom} onPress={() => setShowCustom(true)} />
          </View>
          {showCustom && (
            <Input
              placeholder={t('generateSheet.customPlaceholder')}
              value={customEquipment}
              onChangeText={setCustomEquipment}
            />
          )}
        </>
      )}

      <View className="mt-6">
        <Button
          label={t('generateSheet.submit')}
          variant="primary"
          size="lg"
          disabled={!canSubmit}
          onPress={() =>
            modality &&
            onGenerate({
              modality,
              days_per_week: days,
              minutes_per_session: minutes,
              equipment: resolvedEquipment,
            })
          }
        />
      </View>
    </Sheet>
  );
});
