export type NotifType =
  | 'missed_workout'
  | 'diet_alert'
  | 'progress_update'
  | 'goal_milestone'
  | 'plan_ready';

export interface NotifPrefs {
  notif_reminders: boolean;
  notif_updates: boolean;
}

export function passesPrefs(type: NotifType, prefs: NotifPrefs): boolean {
  if (type === 'missed_workout' || type === 'diet_alert') return prefs.notif_reminders;
  return prefs.notif_updates;
}
