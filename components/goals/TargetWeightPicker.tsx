import { useState } from 'react';
import { View, Text } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Chip';
import { useTheme } from '@/lib/theme';
import { addCalendarMonths, toISODateString, MIN_TARGET_DATE_DAYS_AHEAD } from '@/lib/weightGoalSafety';

interface TargetWeightPickerProps {
  weightValue: string;
  onChangeWeight: (value: string) => void;
  targetDate: string | null;
  onChangeTargetDate: (value: string | null) => void;
}

const PERIOD_OPTIONS = [
  { months: 1, key: 'oneMonth' as const },
  { months: 3, key: 'threeMonths' as const },
  { months: 6, key: 'sixMonths' as const },
];

export function TargetWeightPicker({ weightValue, onChangeWeight, targetDate, onChangeTargetDate }: TargetWeightPickerProps) {
  const { t } = useTranslation('common');
  const { colors } = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const minimumDate = new Date(Date.now() + MIN_TARGET_DATE_DAYS_AHEAD * 86_400_000);

  function periodDate(months: number): string {
    return toISODateString(addCalendarMonths(new Date(), months));
  }

  const isCustomDate = !!targetDate && !PERIOD_OPTIONS.some((p) => targetDate === periodDate(p.months));
  const customLabel = isCustomDate && targetDate ? new Date(targetDate).toLocaleDateString() : t('targetWeight.customDate');

  function handlePickerChange(event: DateTimePickerEvent, date?: Date) {
    setShowPicker(false);
    if (event.type === 'set' && date) {
      onChangeTargetDate(toISODateString(date));
    }
  }

  return (
    <View className="gap-3">
      <Input
        label={t('targetWeight.weightLabel')}
        placeholder={t('targetWeight.weightPlaceholder')}
        value={weightValue}
        onChangeText={onChangeWeight}
        keyboardType="decimal-pad"
      />
      <View>
        <Text style={{ fontFamily: 'Inter-Medium', fontSize: 14, color: colors.textMuted, marginBottom: 8 }}>
          {t('targetWeight.periodLabel')}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {PERIOD_OPTIONS.map((p) => (
            <Chip
              key={p.months}
              label={t(`targetWeight.${p.key}`)}
              selected={targetDate === periodDate(p.months)}
              onPress={() => onChangeTargetDate(periodDate(p.months))}
            />
          ))}
          <Chip label={customLabel} selected={isCustomDate} onPress={() => setShowPicker(true)} />
        </View>
      </View>
      {showPicker ? (
        <DateTimePicker
          value={targetDate ? new Date(targetDate) : minimumDate}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          onChange={handlePickerChange}
        />
      ) : null}
    </View>
  );
}
