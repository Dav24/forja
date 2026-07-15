export type GoalTypeForWeight = 'weight_loss' | 'muscle_gain';

export interface WeightGoalCheckInput {
  goalType: GoalTypeForWeight;
  currentWeightKg: number;
  targetWeightKg: number;
  targetDate: string; // YYYY-MM-DD
  today?: Date; // inyectable para trazas manuales
}

export interface WeightGoalCheckResult {
  valid: boolean;
  reasonKey?: 'wrongDirection' | 'unsafeRate';
  rateKgPerWeek?: number;
  maxSafeRateKgPerWeek?: number;
}

const MAX_WEEKLY_RATE_PCT: Record<GoalTypeForWeight, number> = {
  weight_loss: 0.01,
  muscle_gain: 0.005,
};

const DIRECTION_MARGIN_KG = 0.1;

export function checkWeightGoalSafety(input: WeightGoalCheckInput): WeightGoalCheckResult {
  const { goalType, currentWeightKg, targetWeightKg, targetDate } = input;
  const today = input.today ?? new Date();

  if (goalType === 'weight_loss' && targetWeightKg >= currentWeightKg - DIRECTION_MARGIN_KG) {
    return { valid: false, reasonKey: 'wrongDirection' };
  }
  if (goalType === 'muscle_gain' && targetWeightKg <= currentWeightKg + DIRECTION_MARGIN_KG) {
    return { valid: false, reasonKey: 'wrongDirection' };
  }

  const target = new Date(targetDate);
  const daysUntil = Math.max(1, Math.ceil((target.getTime() - today.getTime()) / 86_400_000));
  const weeksUntil = Math.max(1, daysUntil / 7);

  const rateKgPerWeek = Math.abs(targetWeightKg - currentWeightKg) / weeksUntil;
  const maxSafeRateKgPerWeek = currentWeightKg * MAX_WEEKLY_RATE_PCT[goalType];

  if (rateKgPerWeek > maxSafeRateKgPerWeek) {
    return { valid: false, reasonKey: 'unsafeRate', rateKgPerWeek, maxSafeRateKgPerWeek };
  }

  return { valid: true };
}

export function addCalendarMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function toISODateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export const MIN_TARGET_DATE_DAYS_AHEAD = 14;
