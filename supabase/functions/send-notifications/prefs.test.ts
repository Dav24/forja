import { assertEquals } from 'jsr:@std/assert';
import { passesPrefs } from './prefs.ts';

Deno.test('reminders controla missed_workout y diet_alert', () => {
  const on = { notif_reminders: true, notif_updates: false };
  const off = { notif_reminders: false, notif_updates: true };
  assertEquals(passesPrefs('missed_workout', on), true);
  assertEquals(passesPrefs('diet_alert', on), true);
  assertEquals(passesPrefs('missed_workout', off), false);
  assertEquals(passesPrefs('diet_alert', off), false);
});

Deno.test('updates controla progress_update, goal_milestone y plan_ready', () => {
  const on = { notif_reminders: false, notif_updates: true };
  const off = { notif_reminders: true, notif_updates: false };
  assertEquals(passesPrefs('progress_update', on), true);
  assertEquals(passesPrefs('goal_milestone', on), true);
  assertEquals(passesPrefs('plan_ready', on), true);
  assertEquals(passesPrefs('progress_update', off), false);
  assertEquals(passesPrefs('goal_milestone', off), false);
  assertEquals(passesPrefs('plan_ready', off), false);
});
