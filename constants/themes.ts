// Tokens del rediseño "Forja Atlética" — valores CONGELADOS del prototipo
// (docs/superpowers/prototypes/forja-atletica.html). Cambios de color se hacen
// AQUÍ (en el token), nunca en el componente.
export type ThemeName = 'light' | 'dark';
export type ThemePref = ThemeName | 'system';

const dark = {
  background: '#0C0A09',
  backgroundAlt: '#12100E',
  surface: '#1A1613',
  surfaceElevated: '#252019',
  border: 'rgba(250,247,242,0.09)',
  borderStrong: 'rgba(250,247,242,0.16)',
  text: '#FAF7F2',
  textMuted: '#A89E92',
  textFaint: '#6E655B',
  primary: '#FF6B1A',
  primaryDeep: '#F97316',
  primaryText: '#FF8A3D',
  primaryDim: '#7C2D12',
  onPrimary: '#140A04',
  accent: '#FBBF24',
  accentText: '#FBBF24',
  chip: 'rgba(250,247,242,0.06)',
  glass: 'rgba(18,15,13,0.72)',
  glassBorder: 'rgba(250,247,242,0.12)',
  ringTrack: 'rgba(250,247,242,0.08)',
  success: '#22C55E',
  warning: '#F59E0B',
  destructive: '#EF4444',
  chipWarning: 'rgba(69,26,3,1)',
  chipDanger: 'rgba(69,10,10,1)',
};

const light: typeof dark = {
  background: '#EFEAE3',
  backgroundAlt: '#EAE4DB',
  surface: '#F7F3ED',
  surfaceElevated: '#FFFFFF',
  border: 'rgba(28,19,12,0.10)',
  borderStrong: 'rgba(28,19,12,0.18)',
  text: '#181310',
  textMuted: '#6E6459',
  textFaint: '#9A8F83',
  primary: '#EA580C',
  primaryDeep: '#C2410C',
  primaryText: '#C2410C',
  primaryDim: '#FFEDD5',
  onPrimary: '#FFF7F0',
  accent: '#D97706',
  accentText: '#92610A',
  chip: 'rgba(28,19,12,0.05)',
  glass: 'rgba(247,243,237,0.78)',
  glassBorder: 'rgba(28,19,12,0.10)',
  ringTrack: 'rgba(28,19,12,0.09)',
  success: '#15803D',
  warning: '#B45309',
  destructive: '#DC2626',
  chipWarning: '#FEF3C7',
  chipDanger: '#FEE2E2',
};

export type Theme = typeof dark;
export const themes: Record<ThemeName, Theme> = { dark, light };

export const gradientsByTheme: Record<ThemeName, { ember: readonly [string, string]; flame: readonly [string, string, string]; amber: readonly [string, string] }> = {
  dark: { ember: ['#FBBF24', '#FF6B1A'], flame: ['#EA580C', '#F97316', '#FDE68A'], amber: ['#FDE68A', '#FBBF24'] },
  light: { ember: ['#D97706', '#EA580C'], flame: ['#C2410C', '#EA580C', '#FBBF24'], amber: ['#D97706', '#92610A'] },
};

export const fireShadowByTheme: Record<ThemeName, object> = {
  dark: { shadowColor: '#F97316', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 22, elevation: 8 },
  light: { shadowColor: '#EA580C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.30, shadowRadius: 20, elevation: 6 },
};

// Variante ámbar del fire shadow — nutrición usa ámbar como color de familia (entrenamiento usa naranja)
export const amberShadowByTheme: Record<ThemeName, object> = {
  dark: { shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 7 },
  light: { shadowColor: '#D97706', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 18, elevation: 6 },
};
