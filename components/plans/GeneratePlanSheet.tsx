import { forwardRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import { Sheet } from '@/components/ui/Sheet';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { MODALITIES, type ModalityId } from '@/constants/modalities';
import { useActiveGoal } from '@/hooks/useProfile';
import type { GeneratePlanParams } from '@/hooks/useWorkoutPlan';

interface Props {
  onGenerate: (params: GeneratePlanParams) => void;
}

const DAYS = [3, 4, 5, 6];
const MINUTES = [30, 45, 60, 90];

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`rounded-full px-4 py-2 border ${on ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
      activeOpacity={0.7}
    >
      <Text className={`text-sm ${on ? 'text-primary' : 'text-text'}`}>{label}</Text>
    </TouchableOpacity>
  );
}

export const GeneratePlanSheet = forwardRef<BottomSheet, Props>(function GeneratePlanSheet(
  { onGenerate },
  ref,
) {
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

  const presets = MODALITIES.find((m) => m.id === modality)?.equipmentPresets ?? [];
  const resolvedEquipment = showCustom ? customEquipment.trim() : (equipment ?? presets[0] ?? '');
  const canSubmit = !!modality && resolvedEquipment.length > 0;

  function selectModality(id: ModalityId) {
    setModality(id);
    setEquipment(null);
    setShowCustom(false);
    setCustomEquipment('');
  }

  return (
    <Sheet ref={ref} snapPoints={['85%']} scrollable>
      <Text className="text-text font-bold text-2xl mb-1">Forjar tu plan</Text>
      <Text className="text-text-muted text-sm mb-5">Dime cómo entrenas y lo armo a tu medida.</Text>

      <Text className="text-text font-semibold text-base mb-2">Disciplina</Text>
      <View className="flex-row flex-wrap gap-2 mb-5">
        {MODALITIES.map((m) => (
          <Chip key={m.id} label={`${m.icon} ${m.label}`} on={modality === m.id} onPress={() => selectModality(m.id)} />
        ))}
      </View>

      <Text className="text-text font-semibold text-base mb-2">Días por semana</Text>
      <View className="flex-row gap-2 mb-5">
        {DAYS.map((d) => (
          <Chip key={d} label={`${d}`} on={days === d} onPress={() => setDays(d)} />
        ))}
      </View>

      <Text className="text-text font-semibold text-base mb-2">Minutos por sesión</Text>
      <View className="flex-row gap-2 mb-5">
        {MINUTES.map((m) => (
          <Chip key={m} label={`${m}`} on={minutes === m} onPress={() => setMinutes(m)} />
        ))}
      </View>

      {modality && (
        <>
          <Text className="text-text font-semibold text-base mb-2">Equipo disponible</Text>
          <View className="flex-row flex-wrap gap-2 mb-3">
            {presets.map((p) => (
              <Chip
                key={p}
                label={p}
                on={!showCustom && (equipment ?? presets[0]) === p}
                onPress={() => { setEquipment(p); setShowCustom(false); }}
              />
            ))}
            <Chip label="Otro…" on={showCustom} onPress={() => setShowCustom(true)} />
          </View>
          {showCustom && (
            <Input
              placeholder="Describe tu equipo"
              value={customEquipment}
              onChangeText={setCustomEquipment}
            />
          )}
        </>
      )}

      <View className="mt-6">
        <Button
          label="Forjar mi plan"
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
