// Progreso semanal aproximado (Fase B): días de ENTRENAMIENTO del plan ya
// transcurridos esta semana / totales. day_number 1=Lun … 7=Dom (JS: 0=Dom).
// Fase C lo sustituye por sesiones completadas reales.
export function weekProgress(
  schedule: { day_number: number; is_rest: boolean }[],
  todayJsDay: number,
): { done: number; total: number } {
  const train = schedule.filter((d) => !d.is_rest);
  const total = train.length;
  const todayNumber = todayJsDay === 0 ? 7 : todayJsDay;
  const done = train.filter((d) => d.day_number <= todayNumber).length;
  return { done, total };
}
