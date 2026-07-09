import { assertEquals, assertStringIncludes } from 'jsr:@std/assert';
import { getNotificationText } from './texts.ts';

Deno.test('es por defecto y con parámetros', () => {
  const t = getNotificationText('goal_approaching', 'es', { daysLeft: 3 });
  assertStringIncludes(t.body, '3 días');
  assertStringIncludes(t.body, 'Vulcano');
});

Deno.test('en traduce título y cuerpo', () => {
  const t = getNotificationText('goal_achieved', 'en');
  assertEquals(t.title, 'You did it! 🏆');
});

Deno.test('nunca menciona a Memo', () => {
  for (const kind of ['goal_achieved', 'goal_approaching', 'missed_workout_premium', 'greeting_premium', 'missed_workout_free', 'greeting_free'] as const) {
    for (const lang of ['es', 'en'] as const) {
      const t = getNotificationText(kind, lang, { daysLeft: 2 });
      assertEquals(`${t.title} ${t.body}`.includes('Memo'), false);
    }
  }
});
