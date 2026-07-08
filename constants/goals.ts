export type GoalType =
  | 'weight_loss' | 'muscle_gain' | 'recomposition'
  | 'powerlifting' | 'sport_specific' | 'general_fitness';

export const GOALS: { type: GoalType; icon: string; titleKey: string; descriptionKey: string }[] = [
  { type: 'weight_loss',     icon: '🔥', titleKey: 'onboarding:goals.weight_loss.title',     descriptionKey: 'onboarding:goals.weight_loss.description' },
  { type: 'muscle_gain',     icon: '💪', titleKey: 'onboarding:goals.muscle_gain.title',     descriptionKey: 'onboarding:goals.muscle_gain.description' },
  { type: 'recomposition',   icon: '⚡', titleKey: 'onboarding:goals.recomposition.title',   descriptionKey: 'onboarding:goals.recomposition.description' },
  { type: 'powerlifting',    icon: '🏋️', titleKey: 'onboarding:goals.powerlifting.title',    descriptionKey: 'onboarding:goals.powerlifting.description' },
  { type: 'sport_specific',  icon: '🏃', titleKey: 'onboarding:goals.sport_specific.title',  descriptionKey: 'onboarding:goals.sport_specific.description' },
  { type: 'general_fitness', icon: '✨', titleKey: 'onboarding:goals.general_fitness.title', descriptionKey: 'onboarding:goals.general_fitness.description' },
];

export type FitnessLevel = 'casual' | 'intermediate' | 'intensive' | 'advanced' | 'elite';

export const FITNESS_LEVELS: { value: FitnessLevel; labelKey: string; descriptionKey: string }[] = [
  { value: 'casual',       labelKey: 'onboarding:levels.casual.label',       descriptionKey: 'onboarding:levels.casual.description' },
  { value: 'intermediate', labelKey: 'onboarding:levels.intermediate.label', descriptionKey: 'onboarding:levels.intermediate.description' },
  { value: 'intensive',    labelKey: 'onboarding:levels.intensive.label',    descriptionKey: 'onboarding:levels.intensive.description' },
  { value: 'advanced',     labelKey: 'onboarding:levels.advanced.label',     descriptionKey: 'onboarding:levels.advanced.description' },
  { value: 'elite',        labelKey: 'onboarding:levels.elite.label',        descriptionKey: 'onboarding:levels.elite.description' },
];

export type TrainingMode = 'flexible' | 'strict';

export const MODES: { value: TrainingMode; labelKey: string; descriptionKey: string; icon: string }[] = [
  { value: 'flexible', icon: '🌊', labelKey: 'onboarding:modes.flexible.label', descriptionKey: 'onboarding:modes.flexible.description' },
  { value: 'strict',   icon: '🎯', labelKey: 'onboarding:modes.strict.label',  descriptionKey: 'onboarding:modes.strict.description' },
];
