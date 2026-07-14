import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/lib/theme';
import { useTranslation } from 'react-i18next';

interface Day { day_number: number; is_rest: boolean; estimated_duration_minutes?: number; exercises?: unknown[] }
interface Props { schedule: Day[]; todayJsDay: number }

// Mini-calendario del prototipo (.weekbar): 7 barras de intensidad; hoy con
// gradiente ámbar→ember y ring; días pasados de entrenamiento en primaryDeep.
export function WeekBars({ schedule, todayJsDay }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation('common');
  const todayNumber = todayJsDay === 0 ? 7 : todayJsDay;
  const byNumber = new Map(schedule.map((d) => [d.day_number, d]));
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
      {[1, 2, 3, 4, 5, 6, 7].map((n) => {
        const day = byNumber.get(n);
        const isRest = day?.is_rest ?? true;
        const isToday = n === todayNumber;
        const isPast = n < todayNumber;
        // intensidad ∝ nº de ejercicios (proxy de Fase B; logs reales en C)
        const intensity = isRest ? 0 : Math.min(1, ((day?.exercises?.length ?? 4) / 8));
        const h = 8 + intensity * 34;
        const jsDay = n === 7 ? 0 : n;
        return (
          <View key={n} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: '100%', height: 42, borderRadius: 8, overflow: 'hidden',
                justifyContent: 'flex-end', backgroundColor: colors.chip,
                borderWidth: isToday ? 1.5 : 0, borderColor: colors.primary,
              }}
            >
              {intensity > 0 ? (
                isToday ? (
                  <LinearGradient colors={[colors.accent, colors.primary]} style={{ height: h, borderRadius: 8 }} />
                ) : (
                  <View style={{ height: h, borderRadius: 8, backgroundColor: isPast ? colors.primaryDeep : colors.primaryDim, opacity: isPast ? 0.85 : 1 }} />
                )
              ) : null}
            </View>
            <Text style={{ fontFamily: isToday ? 'SpaceGrotesk-Bold' : 'Inter-Medium', fontSize: 10, letterSpacing: 0.5, color: isToday ? colors.primaryText : colors.textFaint }}>
              {t(`daysShort.${jsDay}`)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
