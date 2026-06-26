import { useState } from 'react';
import { View, Text } from 'react-native';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useLogBodyData } from '@/hooks/useBodyTracking';
import { useIsPremium } from '@/hooks/useSubscription';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';

interface MeasurementFormProps {
  initialValues?: {
    weight_kg?: number;
    body_fat_pct?: number;
    muscle_mass_kg?: number;
  };
  isUpdate?: boolean;
  onSuccess: () => void;
}

export function MeasurementForm({ initialValues, isUpdate = false, onSuccess }: MeasurementFormProps) {
  const isPremium = useIsPremium();
  const { mutate, isPending, error } = useLogBodyData();

  const [weightKg, setWeightKg] = useState(initialValues?.weight_kg?.toString() ?? '');
  const [bodyFatPct, setBodyFatPct] = useState(initialValues?.body_fat_pct?.toString() ?? '');
  const [muscleMassKg, setMuscleMassKg] = useState(initialValues?.muscle_mass_kg?.toString() ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);

  function validate(): string | null {
    const w = parseFloat(weightKg);
    if (!weightKg || isNaN(w) || w < 20 || w > 300) return 'El peso debe estar entre 20 y 300 kg';
    if (isPremium && bodyFatPct) {
      const bf = parseFloat(bodyFatPct);
      if (isNaN(bf) || bf < 2 || bf > 60) return 'La grasa corporal debe estar entre 2 y 60 %';
    }
    if (isPremium && muscleMassKg) {
      const mm = parseFloat(muscleMassKg);
      if (isNaN(mm) || mm < 10 || mm > 150) return 'La masa muscular debe estar entre 10 y 150 kg';
    }
    return null;
  }

  function handleSubmit() {
    const err = validate();
    if (err) { setValidationError(err); return; }
    setValidationError(null);
    const entry: { weight_kg: number; body_fat_pct?: number; muscle_mass_kg?: number } = {
      weight_kg: parseFloat(weightKg),
    };
    if (isPremium && bodyFatPct) entry.body_fat_pct = parseFloat(bodyFatPct);
    if (isPremium && muscleMassKg) entry.muscle_mass_kg = parseFloat(muscleMassKg);
    mutate(entry, { onSuccess });
  }

  return (
    <View style={{ gap: 16 }}>
      <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: typography.sizes.h3, color: colors.text }}>
        {isUpdate ? 'Actualizar medidas' : 'Registrar medidas'}
      </Text>

      <Input
        label="Peso (kg)"
        value={weightKg}
        onChangeText={setWeightKg}
        placeholder="70.5"
        keyboardType="decimal-pad"
      />

      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: 14, color: colors.text }}>
            Grasa corporal (%)
          </Text>
          {!isPremium && <Badge label="Premium" variant="accent" />}
        </View>
        <Input
          value={bodyFatPct}
          onChangeText={setBodyFatPct}
          placeholder="18.5"
          keyboardType="decimal-pad"
          editable={isPremium}
          style={{ opacity: isPremium ? 1 : 0.4 }}
        />
      </View>

      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: 14, color: colors.text }}>
            Masa muscular (kg)
          </Text>
          {!isPremium && <Badge label="Premium" variant="accent" />}
        </View>
        <Input
          value={muscleMassKg}
          onChangeText={setMuscleMassKg}
          placeholder="35.0"
          keyboardType="decimal-pad"
          editable={isPremium}
          style={{ opacity: isPremium ? 1 : 0.4 }}
        />
      </View>

      {(validationError || error) && (
        <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.destructive }}>
          {validationError ?? 'Error al guardar. Intenta de nuevo.'}
        </Text>
      )}

      <Button
        label={isUpdate ? 'Actualizar' : 'Registrar'}
        onPress={handleSubmit}
        loading={isPending}
        disabled={!weightKg}
      />
    </View>
  );
}
