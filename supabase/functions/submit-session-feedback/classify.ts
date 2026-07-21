export type ClassificationLabel = 'flojera' | 'complicacion_real' | 'posible_molestia';
export type SuggestedAction = 'bajar_carga' | 'pausar_ejercicio' | 'requiere_sustitucion' | 'sin_accion';

export interface ClassifyInput {
  comment: string | null;
  problemTags: string[];
  exerciseName: string;
  hasPainHistory3Sessions: boolean;
}

export interface ClassifyResult {
  label: ClassificationLabel;
  action: SuggestedAction;
}

const SYSTEM_PROMPT = `Eres un clasificador de feedback de entrenamiento para la app Forja. NUNCA diagnostiques ni nombres condiciones médicas — solo clasifica la intención del usuario y sugiere una acción sobre el PLAN de entrenamiento, nunca sobre su salud.

Clasificaciones posibles:
- "flojera": el usuario no quiso esforzarse, sin motivo real (ej. "qué flojera", "no me gustó", "me cansé mucho").
- "complicacion_real": tuvo un problema legítimo no relacionado a dolor físico (ej. no tuvo tiempo, no tuvo el equipo).
- "posible_molestia": mencionó dolor o molestia física.

Si la clasificación es "posible_molestia", la única acción válida es "bajar_carga", "pausar_ejercicio", o "requiere_sustitucion" — NUNCA sugieras subir intensidad ante una molestia. Si hay reincidencia de dolor (3+ sesiones seguidas en el mismo ejercicio), usa "requiere_sustitucion" directamente. Si la clasificación es "flojera", la acción es "sin_accion" salvo que el patrón de sesiones ya justifique un ajuste (eso lo decide el motor, no tú). Si es "complicacion_real" sin relación a dolor, la acción es "sin_accion".

Responde SOLO un objeto JSON, sin texto adicional: {"label": "...", "action": "..."}`;

export async function classifyFeedback(apiKey: string, input: ClassifyInput): Promise<ClassifyResult> {
  const userPrompt = `Ejercicio: ${input.exerciseName}
Comentario del usuario: ${input.comment ?? '(sin comentario)'}
Problemas marcados: ${input.problemTags.length > 0 ? input.problemTags.join(', ') : 'ninguno'}
Reincidencia de dolor en este ejercicio (3+ sesiones seguidas): ${input.hasPainHistory3Sessions ? 'sí' : 'no'}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`classifyFeedback: Anthropic API error ${res.status}`);
  }

  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? '{}';
  const parsed = JSON.parse(text.trim());
  return { label: parsed.label, action: parsed.action };
}
