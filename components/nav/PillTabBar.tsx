import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useTheme } from '@/lib/theme';
import { useNavVisibility, PILL_BOTTOM_GAP } from '@/lib/scrollNav';
import { TabIcon, type TabIconName } from '@/components/nav/TabIcons';

const ICON_BY_ROUTE: Record<string, TabIconName> = {
  index: 'home',
  chat: 'coach',
  plans: 'plans',
  progress: 'progress',
  profile: 'profile',
};

export function PillTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, resolved } = useTheme();
  const insets = useSafeAreaInsets();
  const hidden = useNavVisibility();
  const [keyboardUp, setKeyboardUp] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardUp(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Siempre visible al cambiar de tab
  useEffect(() => { hidden.value = 0; }, [state.index, hidden]);

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: withSpring(hidden.value * 90, { damping: 18, stiffness: 180 }) }],
    opacity: withTiming(hidden.value ? 0 : 1, { duration: 200 }),
  }));

  if (keyboardUp) return null; // conserva el comportamiento tabBarHideOnKeyboard

  const focusedRouteName = state.routes[state.index].name;
  if (!ICON_BY_ROUTE[focusedRouteName]) return null; // tabs ocultos (settings/upgrade/success): sin pill

  const visibleRoutes = state.routes.filter((r) => ICON_BY_ROUTE[r.name]);

  const inner = (
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 6, gap: 2 }}>
      {visibleRoutes.map((route) => {
        const focused = state.routes[state.index].key === route.key;
        const { options } = descriptors[route.key];
        const label = typeof options.title === 'string' ? options.title : route.name;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={label}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name as never);
            }}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              paddingVertical: 10,
              paddingHorizontal: 13,
              borderRadius: 999,
              backgroundColor: focused ? colors.chip : 'transparent',
            }}
          >
            <TabIcon name={ICON_BY_ROUTE[route.name]} color={focused ? colors.primaryText : colors.textMuted} />
            {focused ? (
              <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 11.5, letterSpacing: 0.8, color: colors.primaryText }}>
                {label.toUpperCase()}
              </Text>
            ) : null}
            {focused ? (
              <View
                style={{
                  position: 'absolute', bottom: 4, alignSelf: 'center', left: '50%', marginLeft: -2,
                  width: 4, height: 4, borderRadius: 99,
                  backgroundColor: colors.accent,
                  shadowColor: colors.primary, shadowOpacity: 0.9, shadowRadius: 5, shadowOffset: { width: 0, height: 0 },
                }}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          alignSelf: 'center',
          bottom: Math.max(insets.bottom, 12) + PILL_BOTTOM_GAP,
          borderRadius: 999,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.glassBorder,
          shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 10 },
          elevation: 12,
        },
        barStyle,
      ]}
    >
      {Platform.OS === 'ios' ? (
        <BlurView intensity={40} tint={resolved === 'dark' ? 'dark' : 'light'} style={{ backgroundColor: colors.glass }}>
          {inner}
        </BlurView>
      ) : (
        // Android sin blur (decisión de spec): fondo glass semi-opaco
        <View style={{ backgroundColor: colors.glass }}>{inner}</View>
      )}
    </Animated.View>
  );
}
