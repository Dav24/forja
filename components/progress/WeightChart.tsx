import { useMemo, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useIsPremium } from '@/hooks/useSubscription';
import { useTheme } from '@/lib/theme';
import { formatDate } from '@/lib/formatDate';
import { UpgradeSheet } from '@/components/premium/UpgradeSheet';

const CHART_HEIGHT = 160;
const PAD_TOP = 12;
const PAD_BOTTOM = 8;
const PAD_H = 8;

interface DataPoint {
  recorded_at: string;
  weight_kg: number;
}

type RangeKey = '2w' | '1m' | '3m';

const RANGES: { key: RangeKey; labelKey: string; days: number }[] = [
  { key: '2w', labelKey: 'chart.ranges.twoWeeks', days: 14 },
  { key: '1m', labelKey: 'chart.ranges.oneMonth', days: 30 },
  { key: '3m', labelKey: 'chart.ranges.threeMonths', days: 90 },
];

function filterByDays(data: DataPoint[], days: number): DataPoint[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return data.filter((d) => new Date(d.recorded_at) >= cutoff);
}

function toPoints(
  data: DataPoint[],
  chartW: number,
): { x: number; y: number }[] {
  if (data.length === 0) return [];
  const drawW = chartW - PAD_H * 2;
  const drawH = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

  if (data.length === 1) {
    return [{ x: PAD_H + drawW / 2, y: PAD_TOP + drawH / 2 }];
  }

  const minW = Math.min(...data.map((d) => d.weight_kg));
  const maxW = Math.max(...data.map((d) => d.weight_kg));
  const wRange = maxW - minW || 1;
  const minT = new Date(data[0].recorded_at).getTime();
  const maxT = new Date(data[data.length - 1].recorded_at).getTime();
  const tRange = maxT - minT || 1;

  return data.map((d) => ({
    x: PAD_H + ((new Date(d.recorded_at).getTime() - minT) / tRange) * drawW,
    y: PAD_TOP + ((maxW - d.weight_kg) / wRange) * drawH,
  }));
}

function buildSvgPaths(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return { linePath: '', areaPath: '' };

  let linePath = `M ${pts[0].x} ${pts[0].y}`;
  let areaPath = `M ${pts[0].x} ${CHART_HEIGHT - PAD_BOTTOM} L ${pts[0].x} ${pts[0].y}`;

  for (let i = 1; i < pts.length; i++) {
    linePath += ` L ${pts[i].x} ${pts[i].y}`;
    areaPath += ` L ${pts[i].x} ${pts[i].y}`;
  }

  const last = pts[pts.length - 1];
  areaPath += ` L ${last.x} ${CHART_HEIGHT - PAD_BOTTOM} Z`;

  return { linePath, areaPath };
}

interface WeightChartProps {
  data: DataPoint[];
}

export function WeightChart({ data }: WeightChartProps) {
  const { colors } = useTheme();
  const { t } = useTranslation('progress');
  const isPremium = useIsPremium();
  const { width: screenW } = useWindowDimensions();
  const [range, setRange] = useState<RangeKey>('2w');
  const upgradeSheetRef = useRef<any>(null);

  const chartW = screenW - 32;

  const validData = useMemo(
    () => data.filter((d) => d.weight_kg != null),
    [data],
  );

  const filtered = useMemo(() => {
    const r = RANGES.find((x) => x.key === range)!;
    return filterByDays(validData, r.days);
  }, [validData, range]);

  const points = useMemo(() => toPoints(filtered, chartW), [filtered, chartW]);
  const { linePath, areaPath } = useMemo(() => buildSvgPaths(points), [points]);

  const xLabels = useMemo(() => {
    if (filtered.length < 2) return [];
    const step = Math.max(1, Math.floor((filtered.length - 1) / 4));
    const indices = new Set<number>([0]);
    for (let i = step; i < filtered.length - 1; i += step) indices.add(i);
    indices.add(filtered.length - 1);
    return [...indices].map((i) => {
      const label = formatDate(filtered[i].recorded_at, { day: 'numeric', month: 'numeric' });
      return { label, x: points[i]?.x ?? 0 };
    });
  }, [filtered, points]);

  return (
    <View
      className="rounded-2xl p-4 border"
      style={{ backgroundColor: colors.surface, borderColor: colors.border }}
    >
      {/* Header + range selector */}
      <View className="flex-row justify-between items-center mb-3">
        <Text style={{ fontFamily: 'SpaceGrotesk-SemiBold', fontSize: 13, color: colors.textMuted, letterSpacing: 0.5 }}>
          {t('chart.title')}
        </Text>
        <View className="flex-row gap-1">
          {RANGES.map(({ key, labelKey, days }) => {
            const locked = !isPremium && days > 14;
            const active = range === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => {
                  if (locked) {
                    upgradeSheetRef.current?.expand();
                  } else {
                    setRange(key);
                  }
                }}
                activeOpacity={locked ? 1 : 0.7}
                className="px-[10px] py-1 rounded-[20px] border flex-row items-center gap-[3px]"
                style={{
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.primaryDim : 'transparent',
                }}
              >
                <Text style={{
                  fontFamily: 'Inter-Medium', fontSize: 11,
                  color: locked ? colors.textMuted : active ? colors.primary : colors.textMuted,
                }}>
                  {t(labelKey)}
                </Text>
                {locked && <Ionicons name="lock-closed" size={9} color={colors.accent} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Chart or empty state */}
      {filtered.length < 2 ? (
        <View className="h-[160px] items-center justify-center gap-2">
          <Ionicons name="trending-up-outline" size={32} color={colors.textMuted} />
          <Text
            className="text-center"
            style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted }}
          >
            {t('chart.empty')}
          </Text>
        </View>
      ) : (
        <>
          <Svg width={chartW} height={CHART_HEIGHT}>
            <Defs>
              <LinearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#F97316" stopOpacity="0.3" />
                <Stop offset="1" stopColor="#F97316" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            {areaPath ? (
              <Path d={areaPath} fill="url(#weightGrad)" />
            ) : null}
            {linePath ? (
              <Path
                d={linePath}
                stroke={colors.primary}
                strokeWidth={6}
                strokeOpacity={0.25}
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {linePath ? (
              <Path
                d={linePath}
                stroke={colors.primary}
                strokeWidth={2}
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {points.map((p, i) => (
              <Circle key={i} cx={p.x} cy={p.y} r={3} fill={colors.accent} />
            ))}
          </Svg>

          {/* X-axis labels */}
          <View className="h-[18px] relative mt-0.5">
            {xLabels.map(({ label, x }, i) => (
              <Text
                key={i}
                className="absolute w-9 text-center"
                style={{
                  left: x - 18,
                  fontFamily: 'Inter-Regular',
                  fontSize: 10,
                  color: colors.textMuted,
                }}
              >
                {label}
              </Text>
            ))}
          </View>
        </>
      )}
      <UpgradeSheet ref={upgradeSheetRef} context="chart_range" />
    </View>
  );
}
