// supabase/functions/submit-session-feedback/texts.ts
// Copia local de los 2 textos que esta EF envía directo (sin pasar por el
// batch de send-notifications) — ver Global Constraints del plan sobre por
// qué no se comparte un módulo entre carpetas de funciones.
export function getPushText(
  kind: 'plan_adjustment_suggested' | 'plan_adjusted',
  lang: 'es' | 'en',
): { title: string; body: string } {
  if (kind === 'plan_adjustment_suggested') {
    return lang === 'es'
      ? { title: 'Vulcano tiene una sugerencia 🔥', body: 'Revisa el ajuste que propone para tu plan de entrenamiento.' }
      : { title: 'Vulcano has a suggestion 🔥', body: 'Check out the adjustment proposed for your workout plan.' };
  }
  return lang === 'es'
    ? { title: 'Plan ajustado ✅', body: 'Vulcano ajustó tu plan según tu progreso reciente.' }
    : { title: 'Plan adjusted ✅', body: 'Vulcano adjusted your plan based on your recent progress.' };
}
