import Svg, { Path, Circle, Rect } from 'react-native-svg';

export type TabIconName = 'home' | 'coach' | 'plans' | 'progress' | 'profile';

interface Props { name: TabIconName; color: string; size?: number }

export function TabIcon({ name, color, size = 21 }: Props) {
  const p = { width: size, height: size, viewBox: '0 0 19 19', fill: 'none' as const };
  switch (name) {
    case 'home':
      return (
        <Svg {...p}>
          <Path d="M3 8.2 9.5 3 16 8.2V16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.2Z" fill={color} opacity={0.35} />
          <Path d="M9.5 1.6 1.8 7.8l1 1.2 6.7-5.4 6.7 5.4 1-1.2L9.5 1.6Z" fill={color} />
        </Svg>
      );
    case 'coach':
      return (
        <Svg {...p}>
          <Path d="M9.5 2.5c4 0 7 2.6 7 6s-3 6-7 6c-.8 0-1.6-.1-2.3-.3L3.5 16l.9-2.9c-1.2-1-1.9-2.5-1.9-4.6 0-3.4 3-6 7-6Z" fill={color} opacity={0.35} />
          <Path d="M9.7 5.4c.3 1.5 2 2.3 2.7 3.7a3.1 3.1 0 1 1-5.6.3c.5-1.4 1.2-1.7 1.4-2.8.6.4.9 1 1 1.7.5-.8.6-1.8.5-2.9Z" fill={color} />
        </Svg>
      );
    case 'plans':
      return (
        <Svg {...p}>
          <Rect x="5.4" y="4" width="8.2" height="11" rx="1.5" fill={color} opacity={0.35} />
          <Path d="M1.5 7.2h1.8v4.6H1.5V7.2Zm14.2 0h1.8v4.6h-1.8V7.2ZM4 5.6h1.9v7.8H4V5.6Zm9.1 0H15v7.8h-1.9V5.6ZM7 8.6h5v1.8H7V8.6Z" fill={color} />
        </Svg>
      );
    case 'progress':
      return (
        <Svg {...p}>
          <Path d="M2.5 12.5 7 8l3 3 6.5-6.5V16h-14v-3.5Z" fill={color} opacity={0.35} />
          <Path d="M2 11.6 6.9 6.7l3 3 5.6-5.6 1.1 1.1-6.7 6.7-3-3-3.8 3.8L2 11.6Z" fill={color} />
        </Svg>
      );
    case 'profile':
      return (
        <Svg {...p}>
          <Circle cx="9.5" cy="6.3" r="3.6" fill={color} opacity={0.35} />
          <Path d="M2.8 16.4c.7-3.1 3.5-4.9 6.7-4.9s6 1.8 6.7 4.9l-1.7.4c-.5-2.3-2.6-3.6-5-3.6s-4.5 1.3-5 3.6l-1.7-.4Z" fill={color} />
        </Svg>
      );
  }
}
