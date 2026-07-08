import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useActiveGoal } from '@/hooks/useProfile';
import { useLatestBodyData } from '@/hooks/useBodyTracking';
import { GOALS, FITNESS_LEVELS, MODES, type GoalType, type FitnessLevel, type TrainingMode } from '@/constants/goals';
import { MODALITIES, type ModalityId } from '@/constants/modalities';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { colors } from '@/constants/colors';

type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Hombre' },
  { value: 'female', label: 'Mujer' },
  { value: 'other', label: 'Otro' },
  { value: 'prefer_not_to_say', label: 'Prefiero no decir' },
];

function Chip({ selected, label, onPress }: { selected: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className={`rounded-full px-4 py-2 border ${selected ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
    >
      <Text className={`text-sm ${selected ? 'text-primary' : 'text-text'}`}>{label}</Text>
    </TouchableOpacity>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text className="mb-3 mt-6" style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, color: colors.text }}>
      {children}
    </Text>
  );
}

export default function TrainingScreen() {
  const { user } = useAuthStore();
  const { data: goal } = useActiveGoal();
  const { data: latestBody } = useLatestBodyData();
  const queryClient = useQueryClient();

  const [goalType, setGoalType] = useState<GoalType | null>(null);
  const [level, setLevel] = useState<FitnessLevel | null>(null);
  const [mode, setMode] = useState<TrainingMode | null>(null);
  const [modality, setModality] = useState<ModalityId | null>(null);
  const [secondary, setSecondary] = useState<ModalityId[]>([]);
  const [sportType, setSportType] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Precargar valores actuales una sola vez
  useEffect(() => {
    if (loaded || goal === undefined || latestBody === undefined) return;
    if (goal) {
      setGoalType(goal.type as GoalType);
      setLevel(goal.fitness_level as FitnessLevel);
      setMode(goal.mode as TrainingMode);
      setModality((goal.modality as ModalityId) ?? null);
      setSecondary((goal.secondary_modalities as ModalityId[]) ?? []);
      setSportType(goal.sport_type ?? '');
    }
    if (latestBody) {
      if (latestBody.height_cm) setHeightCm(String(latestBody.height_cm));
      if (latestBody.age) setAge(String(latestBody.age));
      if (latestBody.gender) setGender(latestBody.gender as Gender);
    }
    setLoaded(true);
  }, [goal, latestBody, loaded]);

  const needsSport = modality === 'ball_sports' || secondary.includes('ball_sports');
  const valid = !!goalType && !!level && !!mode && !!modality;

  function toggleSecondary(id: ModalityId) {
    setSecondary((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  }

  async function handleSave() {
    if (!user || !valid) return;

    // Validar campos numéricos ANTES de cualquier escritura
    const heightNum = heightCm.trim() ? Number(heightCm.trim().replace(',', '.')) : null;
    const ageNum = age.trim() ? Number.parseInt(age.trim(), 10) : null;
    if ((heightNum !== null && !Number.isFinite(heightNum)) || (ageNum !== null && !Number.isFinite(ageNum))) {
      Alert.alert('Revisa tus datos', 'Altura y edad deben ser números.');
      return;
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
      const { error: goalErr } = await supabase.from('goals').insert({
        user_id: user.id,
        type: goalType,
        target_weight_kg: goal?.target_weight_kg ?? null,
        target_date: goal?.target_date ?? null,
        fitness_level: level,
        mode,
        modality,
        secondary_modalities: secondary,
        sport_type: needsSport && sportType.trim() ? sportType.trim() : null,
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

      queryClient.invalidateQueries({ queryKey: ['goal'] });
      queryClient.invalidateQueries({ queryKey: ['body_data'] });
      queryClient.invalidateQueries({ queryKey: ['profile-stats'] });
      Alert.alert('Guardado 🔥', 'Los cambios aplican a tu próximo plan generado.');
      router.back();
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Error desconocido';
      Alert.alert('Error al guardar', message);
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
          Mi entrenamiento
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <SectionTitle>Objetivo</SectionTitle>
        <View className="flex-row flex-wrap gap-2">
          {GOALS.map((g) => (
            <Chip key={g.type} selected={goalType === g.type} label={`${g.icon} ${g.title}`} onPress={() => setGoalType(g.type)} />
          ))}
        </View>

        <SectionTitle>Nivel</SectionTitle>
        <View className="flex-row flex-wrap gap-2">
          {FITNESS_LEVELS.map((l) => (
            <Chip key={l.value} selected={level === l.value} label={l.label} onPress={() => setLevel(l.value)} />
          ))}
        </View>

        <SectionTitle>Modo</SectionTitle>
        <View className="flex-row flex-wrap gap-2">
          {MODES.map((m) => (
            <Chip key={m.value} selected={mode === m.value} label={`${m.icon} ${m.label}`} onPress={() => setMode(m.value)} />
          ))}
        </View>

        <SectionTitle>Disciplina principal</SectionTitle>
        <View className="flex-row flex-wrap gap-2">
          {MODALITIES.map((m) => (
            <Chip
              key={m.id}
              selected={modality === m.id}
              label={`${m.icon} ${m.label}`}
              onPress={() => {
                setModality(m.id);
                setSecondary((prev) => prev.filter((s) => s !== m.id));
              }}
            />
          ))}
        </View>

        <SectionTitle>Disciplinas secundarias (hasta 2)</SectionTitle>
        <View className="flex-row flex-wrap gap-2">
          {MODALITIES.filter((m) => m.id !== modality).map((m) => (
            <Chip key={m.id} selected={secondary.includes(m.id)} label={`${m.icon} ${m.label}`} onPress={() => toggleSecondary(m.id)} />
          ))}
        </View>

        {needsSport ? (
          <View className="mt-4">
            <Text className="mb-2" style={{ fontFamily: 'Inter-Medium', fontSize: 14, color: colors.text }}>¿Qué deporte?</Text>
            <Input placeholder="Fútbol, básquet, tenis..." value={sportType} onChangeText={setSportType} />
          </View>
        ) : null}

        <SectionTitle>Datos básicos</SectionTitle>
        <View className="gap-3">
          <Input label="Altura (cm)" placeholder="170" value={heightCm} onChangeText={setHeightCm} keyboardType="numeric" />
          <Input label="Edad" placeholder="28" value={age} onChangeText={setAge} keyboardType="numeric" />
          <View className="flex-row flex-wrap gap-2">
            {GENDERS.map((g) => (
              <Chip key={g.value} selected={gender === g.value} label={g.label} onPress={() => setGender(g.value)} />
            ))}
          </View>
        </View>

        <View className="mt-8 gap-2">
          <Button label="Guardar cambios" loading={saving} disabled={!valid} onPress={handleSave} />
          <Text className="text-center" style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textMuted }}>
            Los cambios aplican a tu próximo plan generado.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
