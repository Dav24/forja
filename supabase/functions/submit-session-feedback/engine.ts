export type DifficultyRating = 'muy_facil' | 'facil' | 'justo' | 'dificil' | 'muy_dificil';
export type Direction = 'facil' | 'dificil' | 'neutral';

export function classifyDirection(rating: DifficultyRating): Direction {
  if (rating === 'muy_facil' || rating === 'facil') return 'facil';
  if (rating === 'dificil' || rating === 'muy_dificil') return 'dificil';
  return 'neutral';
}

export const NECESSITY_PATTERN_WINDOW = 3;

/** `ratings` viene ordenado más-reciente-primero. */
export function hasSustainedPattern(ratings: DifficultyRating[]): 'facil' | 'dificil' | null {
  if (ratings.length < NECESSITY_PATTERN_WINDOW) return null;
  const recent = ratings.slice(0, NECESSITY_PATTERN_WINDOW).map(classifyDirection);
  const first = recent[0];
  if (first === 'neutral') return null;
  return recent.every((d) => d === first) ? first : null;
}

export const WEIGHT_BUMP_PCT = 0.05;
export const REPS_BUMP = 1;

export interface DeterministicAdjustmentResult {
  field: 'weight_kg' | 'reps';
  before: number;
  after: number;
}

export function computeDeterministicAdjustment(
  direction: 'facil' | 'dificil',
  current: { weightKg: number | null; reps: number },
): DeterministicAdjustmentResult {
  if (current.weightKg != null && current.weightKg > 0) {
    const factor = direction === 'facil' ? 1 + WEIGHT_BUMP_PCT : 1 - WEIGHT_BUMP_PCT;
    const after = Math.round((current.weightKg * factor) / 0.25) * 0.25;
    return { field: 'weight_kg', before: current.weightKg, after: Math.max(0, after) };
  }
  const delta = direction === 'facil' ? REPS_BUMP : -REPS_BUMP;
  const after = Math.max(1, current.reps + delta);
  return { field: 'reps', before: current.reps, after };
}
