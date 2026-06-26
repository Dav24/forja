export const typography = {
  fonts: {
    heading: 'SpaceGrotesk',
    body: 'Inter',
    mono: 'JetBrainsMono',
  },
  sizes: {
    display: 48,
    h1: 28,
    h2: 22,
    h3: 18,
    body: 16,
    bodySmall: 14,
    caption: 12,
    stat: 28,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
} as const;
