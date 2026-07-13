/** @deprecated Fase A del rediseño: usar `useTheme()` de '@/lib/theme'.
 * Este re-export estático (tema oscuro) existe solo para código no-reactivo
 * y se elimina al final de la migración. */
import { themes, gradientsByTheme, fireShadowByTheme } from '@/constants/themes';

export const colors = { ...themes.dark, primaryBright: themes.dark.accent };
export const gradients = gradientsByTheme.dark;
export const fireShadow = fireShadowByTheme.dark;
