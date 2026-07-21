import { forwardRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/lib/theme';
import { useSubmitSessionFeedback, type SubmitSessionFeedbackResponse } from '@/hooks/useSessionFeedback';

type DifficultyRating = 'muy_facil' | 'facil' | 'justo' | 'dificil' | 'muy_dificil';
type ProblemTag = 'ninguno' | 'dolor' | 'no_completo' | 'otro';

const DIFFICULTY_OPTIONS: DifficultyRating[] = ['muy_facil', 'facil', 'justo', 'dificil', 'muy_dificil'];
const PROBLEM_OPTIONS: ProblemTag[] = ['ninguno', 'dolor', 'no_completo', 'otro'];

interface Props {
  workoutPlanId: string;
  dayNumber: number;
  exercises: { order: number; name: string }[];
  onSubmitted: (response: SubmitSessionFeedbackResponse) => void;
}

export const SessionFeedbackSheet = forwardRef<BottomSheet, Props>(
  ({ workoutPlanId, dayNumber, exercises, onSubmitted }, ref) => {
    const { t } = useTranslation('plans');
    const { colors } = useTheme();
    const { mutate, isPending } = useSubmitSessionFeedback();

    const [rating, setRating] = useState<DifficultyRating | null>(null);
    const [problems, setProblems] = useState<ProblemTag[]>(['ninguno']);
    const [comment, setComment] = useState('');
    const [flags, setFlags] = useState<Record<number, 'facil' | 'dificil' | undefined>>({});

    function toggleProblem(tag: ProblemTag) {
      if (tag === 'ninguno') { setProblems(['ninguno']); return; }
      setProblems((prev) => {
        const withoutNinguno = prev.filter((p) => p !== 'ninguno');
        return withoutNinguno.includes(tag)
          ? withoutNinguno.filter((p) => p !== tag)
          : [...withoutNinguno, tag];
      });
    }

    function toggleExerciseFlag(order: number, flag: 'facil' | 'dificil') {
      setFlags((prev) => ({ ...prev, [order]: prev[order] === flag ? undefined : flag }));
    }

    function handleSubmit() {
      if (!rating) return;
      mutate({
        workoutPlanId,
        dayNumber,
        logDate: new Date().toISOString().slice(0, 10),
        difficultyRating: rating,
        problemTags: problems,
        comment: comment.trim() || null,
        exerciseFlags: Object.entries(flags)
          .filter(([, flag]) => flag != null)
          .map(([order, flag]) => ({ exerciseOrder: Number(order), flag: flag! })),
      }, {
        onSuccess: (response) => {
          onSubmitted(response);
        },
        onError: () => Alert.alert('Error', 'No se pudo guardar el feedback. Intenta de nuevo.'),
      });
    }

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={['75%']}
        enablePanDownToClose
        backdropComponent={(props) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />}
        backgroundStyle={{ backgroundColor: colors.surface }}
      >
        <BottomSheetView style={{ padding: 20, gap: 16 }}>
          <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 20, color: colors.text }}>
            {t('sessionFeedback.title')}
          </Text>

          <View>
            <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: colors.textMuted, marginBottom: 8 }}>
              {t('sessionFeedback.difficultyLabel')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {DIFFICULTY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  onPress={() => setRating(opt)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
                    backgroundColor: rating === opt ? colors.primary : colors.surfaceElevated,
                  }}
                >
                  <Text style={{ color: rating === opt ? colors.background : colors.text, fontFamily: 'Inter-Medium', fontSize: 13 }}>
                    {t(`sessionFeedback.difficulty.${opt}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View>
            <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: colors.textMuted, marginBottom: 8 }}>
              {t('sessionFeedback.problemsLabel')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {PROBLEM_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  onPress={() => toggleProblem(opt)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
                    backgroundColor: problems.includes(opt) ? colors.accent : colors.surfaceElevated,
                  }}
                >
                  <Text style={{ color: problems.includes(opt) ? colors.background : colors.text, fontFamily: 'Inter-Medium', fontSize: 13 }}>
                    {t(`sessionFeedback.problems.${opt}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TextInput
            value={comment}
            onChangeText={(v) => setComment(v.slice(0, 300))}
            placeholder={t('sessionFeedback.commentPlaceholder')}
            placeholderTextColor={colors.textFaint}
            multiline
            style={{
              backgroundColor: colors.surfaceElevated, borderRadius: 8, padding: 12,
              color: colors.text, fontFamily: 'Inter-Regular', fontSize: 14, minHeight: 60,
            }}
          />

          {exercises.length > 0 && (
            <View>
              <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: colors.textMuted, marginBottom: 8 }}>
                {t('sessionFeedback.exerciseFlagsLabel')}
              </Text>
              {exercises.map((ex) => (
                <View key={ex.order} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
                  <Text style={{ color: colors.text, fontFamily: 'Inter-Regular', fontSize: 13, flex: 1 }}>{ex.name}</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity onPress={() => toggleExerciseFlag(ex.order, 'facil')}>
                      <Text style={{ fontSize: 18, opacity: flags[ex.order] === 'facil' ? 1 : 0.3 }}>😌</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => toggleExerciseFlag(ex.order, 'dificil')}>
                      <Text style={{ fontSize: 18, opacity: flags[ex.order] === 'dificil' ? 1 : 0.3 }}>😤</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!rating || isPending}
            style={{
              backgroundColor: rating ? colors.primary : colors.surfaceElevated,
              borderRadius: 12, paddingVertical: 14, alignItems: 'center',
            }}
          >
            <Text style={{ color: rating ? colors.background : colors.textFaint, fontFamily: 'SpaceGrotesk-Bold', fontSize: 15 }}>
              {t('sessionFeedback.submit')}
            </Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>
    );
  },
);
SessionFeedbackSheet.displayName = 'SessionFeedbackSheet';
