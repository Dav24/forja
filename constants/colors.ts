export const colors = {
  background: '#0C0A09',
  surface: '#1C1917',
  surfaceElevated: '#292524',
  primary: '#F97316',
  primaryBright: '#FBBF24',
  primaryDim: '#7C2D12',
  accent: '#FBBF24',
  text: '#FAFAF9',
  textMuted: '#A8A29E',
  border: '#292524',
  destructive: '#EF4444',
  warning: '#F59E0B',
  success: '#22C55E',
} as const;

// Gradientes de marca — usar con expo-linear-gradient
export const gradients = {
  ember: ['#FBBF24', '#F97316'] as const,
  flame: ['#EA580C', '#F97316', '#FDE68A'] as const,
} as const;

// Sombra de fuego para CTAs primarios (dosificar: 1-2 por pantalla)
export const fireShadow = {
  shadowColor: '#F97316',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 22,
  elevation: 8,
} as const;
