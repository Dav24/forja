import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { useTheme } from '@/lib/theme';
import { useTranslation } from 'react-i18next';

interface CelebrateOpts { title: string; subtitle?: string; streak?: number }
const CelebrationContext = createContext<{ celebrate: (o: CelebrateOpts) => void }>({ celebrate: () => {} });
export const useCelebration = () => useContext(CelebrationContext);

const SPARKS = 22;

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<CelebrateOpts | null>(null);
  const celebrate = useCallback((o: CelebrateOpts) => setOpts(o), []);
  const value = useMemo(() => ({ celebrate }), [celebrate]);
  return (
    <CelebrationContext.Provider value={value}>
      {children}
      {opts ? <CelebrationOverlay opts={opts} onClose={() => setOpts(null)} /> : null}
    </CelebrationContext.Provider>
  );
}

function CelebrationOverlay({ opts, onClose }: { opts: CelebrateOpts; onClose: () => void }) {
  const { colors } = useTheme();
  const { t } = useTranslation('common');
  const reduced = useReducedMotion();
  // Chispas: dirección aleatoria generada al montar (fuera de todo worklet)
  const sparks = useMemo(
    () => Array.from({ length: reduced ? 0 : SPARKS }, (_, i) => ({
      angle: Math.random() * Math.PI * 2,
      dist: 90 + Math.random() * 130,
      delay: 200 + Math.random() * 350,
      amber: i % 3 !== 0,
    })),
    [reduced],
  );
  return (
    <Animated.View
      entering={reduced ? undefined : FadeIn.duration(250)}
      exiting={reduced ? undefined : FadeOut.duration(200)}
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.background + 'F2',
      }}
    >
      {sparks.map((s, i) => (
        <Animated.View
          key={i}
          entering={FadeIn.delay(s.delay).duration(80)}
          style={{
            position: 'absolute',
            width: 5, height: 5, borderRadius: 99,
            backgroundColor: s.amber ? colors.accent : colors.primary,
            transform: [
              { translateX: Math.cos(s.angle) * s.dist },
              { translateY: Math.sin(s.angle) * s.dist },
            ],
          }}
        />
      ))}
      <Animated.Text
        entering={reduced ? undefined : ZoomIn.springify().damping(12).delay(120)}
        style={{ fontFamily: 'BebasNeue-Regular', fontSize: 48, color: colors.text, letterSpacing: 1 }}
      >
        {opts.title}
      </Animated.Text>
      {opts.subtitle ? (
        <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 13, color: colors.accentText, marginTop: 6 }}>
          {opts.subtitle}
        </Text>
      ) : null}
      {typeof opts.streak === 'number' ? (
        <Animated.View entering={reduced ? undefined : ZoomIn.delay(400)} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 12 }}>
          <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 30, color: colors.text }}>{opts.streak}</Text>
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textMuted }}>{t('streakDays')}</Text>
        </Animated.View>
      ) : null}
      <Pressable
        onPress={onClose}
        style={{ marginTop: 26, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 28 }}
      >
        <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: colors.textMuted }}>{t('continue')}</Text>
      </Pressable>
    </Animated.View>
  );
}
