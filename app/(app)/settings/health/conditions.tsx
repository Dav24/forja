import { useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/lib/theme';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { MEDICAL_CONDITIONS, type MedicalConditionCode } from '@/constants/health';
import {
  useAddFoodPreference, useFoodPreferences, useRemoveFoodPreference, type FoodPreferenceKind,
} from '@/hooks/useFoodPreferences';
import { useAddMedicalCondition, useMedicalConditions, useRemoveMedicalCondition } from '@/hooks/useMedicalConditions';

function PreferenceGroup({
  title, items, kind, onAdd, onRemove, adding,
}: {
  title: string;
  items: { id: string; item: string }[];
  kind: FoodPreferenceKind;
  onAdd: (item: string, kind: FoodPreferenceKind) => void;
  onRemove: (id: string) => void;
  adding: boolean;
}) {
  const { t } = useTranslation('settings');
  const { colors } = useTheme();
  const [text, setText] = useState('');

  function handleAdd() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd(trimmed, kind);
    setText('');
  }

  return (
    <View className="mb-6 gap-3">
      <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, color: colors.text }}>{title}</Text>
      <View className="flex-row flex-wrap gap-2">
        {items.map((it) => (
          <TouchableOpacity
            key={it.id}
            onPress={() => onRemove(it.id)}
            activeOpacity={0.7}
            className="flex-row items-center gap-1.5 rounded-full px-3.5 py-2 border"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: colors.text }}>{it.item}</Text>
            <Ionicons name="close" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
        {items.length === 0 ? (
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted }}>
            {t('foodPreferences.empty')}
          </Text>
        ) : null}
      </View>
      <View className="flex-row gap-2 items-start">
        <View className="flex-1">
          <Input placeholder={t('foodPreferences.addPlaceholder')} value={text} onChangeText={setText} />
        </View>
        <Button label={t('foodPreferences.add')} size="sm" variant="secondary" loading={adding} onPress={handleAdd} />
      </View>
    </View>
  );
}

export default function ConditionsScreen() {
  const { t } = useTranslation('settings');
  const { colors } = useTheme();
  const { data: foodPrefs } = useFoodPreferences();
  const { mutate: addPreference, isPending: addingPref } = useAddFoodPreference();
  const { mutate: removePreference } = useRemoveFoodPreference();
  const { data: conditions } = useMedicalConditions();
  const { mutate: addCondition, isPending: addingCondition } = useAddMedicalCondition();
  const { mutate: removeCondition } = useRemoveMedicalCondition();

  const [selectedCondition, setSelectedCondition] = useState<MedicalConditionCode | null>(null);
  const [conditionNotes, setConditionNotes] = useState('');
  const [dirty, setDirty] = useState(false);

  function handleAddCondition() {
    if (!selectedCondition) return;
    addCondition(
      { condition: selectedCondition, notes: conditionNotes },
      { onSuccess: () => { setSelectedCondition(null); setConditionNotes(''); setDirty(false); } },
    );
  }

  function handleBack() {
    if (dirty) {
      Alert.alert(t('health.discardTitle'), t('health.discardBody'), [
        { text: t('health.discardCancel'), style: 'cancel' },
        { text: t('health.discardConfirm'), style: 'destructive', onPress: () => router.back() },
      ]);
      return;
    }
    router.back();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={handleBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.text, letterSpacing: 1 }}>
          {t('health.conditionsButtonTitle')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted, marginBottom: 20 }}>
          {t('foodPreferences.subtitle')}
        </Text>
        <PreferenceGroup
          title={t('foodPreferences.allergiesTitle')}
          items={foodPrefs?.allergies ?? []}
          kind="allergy"
          onAdd={(item, kind) => { addPreference({ item, kind }); setDirty(true); }}
          onRemove={(id) => { removePreference({ id }); setDirty(true); }}
          adding={addingPref}
        />
        <PreferenceGroup
          title={t('foodPreferences.dislikesTitle')}
          items={foodPrefs?.dislikes ?? []}
          kind="dislike"
          onAdd={(item, kind) => { addPreference({ item, kind }); setDirty(true); }}
          onRemove={(id) => { removePreference({ id }); setDirty(true); }}
          adding={addingPref}
        />

        <FieldLabel first>{t('health.conditionsSectionTitle')}</FieldLabel>
        {(conditions ?? []).map((c) => (
          <View key={c.id} className="flex-row items-center justify-between p-3 mb-2 rounded-xl border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <View className="flex-1">
              <Text style={{ fontFamily: 'Inter-Medium', fontSize: 14, color: colors.text }}>
                {t(MEDICAL_CONDITIONS.find((mc) => mc.value === c.condition)?.labelKey ?? '')}
              </Text>
              {c.notes ? <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textMuted }}>{c.notes}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => { removeCondition({ id: c.id }); setDirty(true); }} hitSlop={12}>
              <Ionicons name="close-circle-outline" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        ))}
        <View className="flex-row flex-wrap gap-2 mb-3">
          {MEDICAL_CONDITIONS.map((c) => (
            <Chip
              key={c.value}
              tint="accent"
              label={t(c.labelKey)}
              selected={selectedCondition === c.value}
              onPress={() => { setSelectedCondition(c.value); setDirty(true); }}
            />
          ))}
        </View>
        {selectedCondition ? (
          <View className="flex-row gap-2 items-start">
            <View className="flex-1">
              <Input placeholder={t('health.notesPlaceholder')} value={conditionNotes} onChangeText={(v) => { setConditionNotes(v); setDirty(true); }} />
            </View>
            <Button label={t('health.addButton')} size="sm" variant="secondary" loading={addingCondition} onPress={handleAddCondition} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
