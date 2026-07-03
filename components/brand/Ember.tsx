import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

interface EmberProps {
  size: number;
  glow?: boolean;
}

// La brasa de la marca: la "O" de FORJA
export function Ember({ size, glow = false }: EmberProps) {
  const r = size / 2;
  return (
    <Svg width={size} height={size} viewBox="0 0 44 44">
      <Defs>
        <RadialGradient id="emberCoal" cx="0.5" cy="0.55" r="0.6">
          <Stop offset="0" stopColor="#FDE68A" />
          <Stop offset="0.55" stopColor="#F97316" />
          <Stop offset="1" stopColor="#EA580C" />
        </RadialGradient>
        <RadialGradient id="emberHalo" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0.6" stopColor="#F97316" stopOpacity="0.45" />
          <Stop offset="1" stopColor="#F97316" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      {glow && <Circle cx="22" cy="22" r="22" fill="url(#emberHalo)" />}
      <Circle cx="22" cy="22" r="16" fill="url(#emberCoal)" />
      <Circle cx="22" cy="22" r="7" fill="#0C0A09" />
    </Svg>
  );
}
