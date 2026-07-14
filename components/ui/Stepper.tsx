import { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/lib/theme';

interface StepperProps {
  value: number;
  onChange: (v: number) => void;
  unit: string;
  step: number;
  decimals: number;
  min?: number;
}

// Botones ±step Y captura directa: teclear "67" con step=2.5 → snap a "67.5";
// "70" → "70.0"; con step=1/decimals=0, "10.7" → "11". Entrada inválida
// conserva el valor previo. Puerto del stepper del prototipo v7.
export function Stepper({ value, onChange, unit, step, decimals, min = 0 }: StepperProps) {
  const { colors } = useTheme();
  const [text, setText] = useState(value.toFixed(decimals));

  useEffect(() => {
    setText(value.toFixed(decimals));
  }, [value, decimals]);

  function snap(raw: string): number {
    const n = parseFloat(raw.replace(',', '.'));
    if (Number.isNaN(n)) return value;
    return Math.max(min, Math.round(n / step) * step);
  }

  function commit(raw: string) {
    const snapped = snap(raw);
    onChange(snapped);
    setText(snapped.toFixed(decimals));
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.chip,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 11,
        padding: 3,
      }}
    >
      <TouchableOpacity
        onPress={() => onChange(Math.max(min, value - step))}
        style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}
      >
        <Text style={{ color: colors.primaryText, fontSize: 17, fontFamily: 'Inter-Regular' }}>−</Text>
      </TouchableOpacity>
      <View style={{ minWidth: 56, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 3 }}>
        <TextInput
          value={text}
          onChangeText={setText}
          onFocus={() => setText(value.toFixed(decimals))}
          onBlur={() => commit(text)}
          onSubmitEditing={() => commit(text)}
          keyboardType="decimal-pad"
          style={{
            width: 42,
            textAlign: 'right',
            color: colors.text,
            fontFamily: 'JetBrainsMono-Medium',
            fontSize: 13.5,
            padding: 0,
          }}
        />
        <Text style={{ fontSize: 9.5, color: colors.textFaint, fontFamily: 'Inter-Regular' }}>{unit}</Text>
      </View>
      <TouchableOpacity
        onPress={() => onChange(value + step)}
        style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}
      >
        <Text style={{ color: colors.primaryText, fontSize: 17, fontFamily: 'Inter-Regular' }}>+</Text>
      </TouchableOpacity>
    </View>
  );
}
