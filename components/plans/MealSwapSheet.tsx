import { forwardRef, useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/ui/Sheet';
import { MacroBar } from '@/components/plans/MacroBar';
import { useTheme } from '@/lib/theme';
import { MEAL_SWAP_PREVIEW_ATTEMPTS_MAX } from '@/lib/limits';
import { useSwapMealAccept, useSwapMealPreview, type MealCandidate } from '@/hooks/useMealSwap';

interface MealSwapSheetProps {
  mealPlanId: string;
  dayNumber: number;
  mealIndex: number;
  onDone: () => void;
}

export const MealSwapSheet = forwardRef<BottomSheet, MealSwapSheetProps>(function MealSwapSheet(
  { mealPlanId, dayNumber, mealIndex, onDone },
  ref,
) {
  const { colors } = useTheme();
  const { t } = useTranslation('plans');
  const [attempt, setAttempt] = useState(0);
  const [candidate, setCandidate] = useState<MealCandidate | null>(null);
  const { mutateAsync: preview, isPending: previewing, error: previewError, reset: resetPreview } = useSwapMealPreview();
  const { mutateAsync: accept, isPending: accepting, error: acceptError, reset: resetAccept } = useSwapMealAccept();

  useEffect(() => {
    setAttempt(0);
    setCandidate(null);
    resetPreview();
    resetAccept();
  }, [dayNumber, mealIndex, resetPreview, resetAccept]);

  async function requestPreview() {
    const nextAttempt = attempt + 1;
    setAttempt(nextAttempt);
    const result = await preview({ mealPlanId, dayNumber, mealIndex, attemptNumber: nextAttempt });
    setCandidate(result);
  }

  async function handleAccept() {
    if (!candidate) return;
    try {
      await accept({ mealPlanId, dayNumber, mealIndex, candidate });
      setAttempt(0);
      setCandidate(null);
      onDone();
    } catch {
      // error surfaced via acceptError below
    }
  }

  function handleCancel() {
    setAttempt(0);
    setCandidate(null);
    onDone();
  }

  return (
    <Sheet ref={ref} snapPoints={['60%']} scrollable>
      <View style={{ paddingTop: 8 }}>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 25, color: colors.text }}>
          {t('mealSwap.title')}
        </Text>

        {!candidate && !previewing ? (
          <TouchableOpacity
            onPress={requestPreview}
            style={{ marginTop: 16, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 13, alignItems: 'center' }}
          >
            <Text style={{ color: colors.onPrimary, fontFamily: 'SpaceGrotesk-Bold', fontSize: 13.5 }}>
              {t('mealSwap.propose')}
            </Text>
          </TouchableOpacity>
        ) : null}

        {previewing ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        {previewError ? (
          <Text style={{ color: colors.destructive, fontFamily: 'Inter-Regular', fontSize: 12.5, marginTop: 12 }}>
            {t('mealSwap.previewError')}
          </Text>
        ) : null}

        {acceptError ? (
          <Text style={{ color: colors.destructive, fontFamily: 'Inter-Regular', fontSize: 12.5, marginTop: 12 }}>
            {t('mealSwap.acceptError')}
          </Text>
        ) : null}

        {candidate ? (
          <View style={{ marginTop: 16 }}>
            <Text style={{ fontFamily: 'SpaceGrotesk-SemiBold', fontSize: 16, color: colors.text }}>{candidate.name}</Text>
            <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
              {candidate.calories} kcal
            </Text>
            <View style={{ marginTop: 10 }}>
              <MacroBar protein_g={candidate.protein_g} carbs_g={candidate.carbs_g} fat_g={candidate.fat_g} />
            </View>
            <Text style={{ fontFamily: 'Inter-Medium', fontSize: 11, color: colors.textMuted, marginTop: 14, marginBottom: 4 }}>
              {t('meal.card.ingredients')}
            </Text>
            {candidate.ingredients.map((ing, i) => (
              <Text key={i} style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.text }}>• {ing}</Text>
            ))}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity
                onPress={handleAccept}
                disabled={accepting}
                style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 13, alignItems: 'center', opacity: accepting ? 0.6 : 1 }}
              >
                {accepting ? <ActivityIndicator color={colors.onPrimary} /> : (
                  <Text style={{ color: colors.onPrimary, fontFamily: 'SpaceGrotesk-Bold', fontSize: 13.5 }}>{t('mealSwap.accept')}</Text>
                )}
              </TouchableOpacity>
              {attempt < MEAL_SWAP_PREVIEW_ATTEMPTS_MAX ? (
                <TouchableOpacity
                  onPress={requestPreview}
                  disabled={previewing}
                  style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingVertical: 13, alignItems: 'center' }}
                >
                  <Text style={{ color: colors.text, fontFamily: 'Inter-Medium', fontSize: 13.5 }}>{t('mealSwap.another')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {attempt >= MEAL_SWAP_PREVIEW_ATTEMPTS_MAX ? (
              <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 12, marginTop: 10, textAlign: 'center' }}>
                {t('mealSwap.attemptsExhausted')}
              </Text>
            ) : null}
          </View>
        ) : null}

        <TouchableOpacity onPress={handleCancel} style={{ marginTop: 14, alignItems: 'center' }}>
          <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Medium', fontSize: 13 }}>{t('mealSwap.cancel')}</Text>
        </TouchableOpacity>
      </View>
    </Sheet>
  );
});
