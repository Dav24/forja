// components/goals/ModalityOrientationPicker.tsx
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Chip';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { useTheme } from '@/lib/theme';
import { MODALITY_GOAL_BRANCHES } from '@/constants/modalityGoals';
import type { ModalityId } from '@/constants/modalities';

interface ModalityOrientationPickerProps {
  modality: ModalityId;
  orientation: string | null;
  onChangeOrientation: (id: string | null) => void;
  notes: string;
  onChangeNotes: (value: string) => void;
  showEditableHint?: boolean;
}

export function ModalityOrientationPicker({
  modality, orientation, onChangeOrientation, notes, onChangeNotes, showEditableHint = false,
}: ModalityOrientationPickerProps) {
  const { t } = useTranslation(['common', 'onboarding']);
  const { colors } = useTheme();
  const branches = MODALITY_GOAL_BRANCHES[modality];

  return (
    <View className="gap-3">
      <FieldLabel first>{t('common:modalityGoal.label')}</FieldLabel>
      <View className="flex-row flex-wrap gap-2">
        {branches.map((b) => (
          <Chip
            key={b.id}
            label={t(b.labelKey)}
            selected={orientation === b.id}
            onPress={() => onChangeOrientation(orientation === b.id ? null : b.id)}
          />
        ))}
      </View>
      <Input
        placeholder={t('common:modalityGoal.notesPlaceholder')}
        value={notes}
        onChangeText={onChangeNotes}
      />
      {showEditableHint ? (
        <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textFaint }}>
          {t('common:modalityGoal.editableHint')}
        </Text>
      ) : null}
    </View>
  );
}
