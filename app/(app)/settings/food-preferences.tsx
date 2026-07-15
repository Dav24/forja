import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/lib/theme';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import {
  useAddFoodPreference,
  useFoodPreferences,
  useRemoveFoodPreference,
  type FoodPreferenceKind,
} from '@/hooks/useFoodPreferences';

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

export default function FoodPreferencesScreen() {
  const { t } = useTranslation('settings');
  const { colors } = useTheme();
  const { data } = useFoodPreferences();
  const { mutate: addPreference, isPending: adding } = useAddFoodPreference();
  const { mutate: removePreference } = useRemoveFoodPreference();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.text, letterSpacing: 1 }}>
          {t('foodPreferences.title')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted, marginBottom: 20 }}>
          {t('foodPreferences.subtitle')}
        </Text>
        <PreferenceGroup
          title={t('foodPreferences.allergiesTitle')}
          items={data?.allergies ?? []}
          kind="allergy"
          onAdd={(item, kind) => addPreference({ item, kind })}
          onRemove={(id) => removePreference({ id })}
          adding={adding}
        />
        <PreferenceGroup
          title={t('foodPreferences.dislikesTitle')}
          items={data?.dislikes ?? []}
          kind="dislike"
          onAdd={(item, kind) => addPreference({ item, kind })}
          onRemove={(id) => removePreference({ id })}
          adding={adding}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
