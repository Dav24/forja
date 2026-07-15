import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

export type GoalType =
  | 'weight_loss' | 'muscle_gain' | 'recomposition'
  | 'powerlifting' | 'sport_specific' | 'general_fitness';

export const GOALS: { type: GoalType; icon: string; iconName: IoniconsName; titleKey: string; descriptionKey: string }[] = [
  { type: 'weight_loss',     icon: '🔥', iconName: 'flame-outline',       titleKey: 'onboarding:goals.weight_loss.title',     descriptionKey: 'onboarding:goals.weight_loss.description' },
  { type: 'muscle_gain',     icon: '💪', iconName: 'trending-up-outline', titleKey: 'onboarding:goals.muscle_gain.title',     descriptionKey: 'onboarding:goals.muscle_gain.description' },
  { type: 'recomposition',   icon: '⚡', iconName: 'sync-outline',        titleKey: 'onboarding:goals.recomposition.title',   descriptionKey: 'onboarding:goals.recomposition.description' },
  { type: 'powerlifting',    icon: '🏋️', iconName: 'barbell-outline',     titleKey: 'onboarding:goals.powerlifting.title',    descriptionKey: 'onboarding:goals.powerlifting.description' },
  { type: 'sport_specific',  icon: '🏃', iconName: 'trophy-outline',      titleKey: 'onboarding:goals.sport_specific.title',  descriptionKey: 'onboarding:goals.sport_specific.description' },
  { type: 'general_fitness', icon: '✨', iconName: 'sparkles-outline',    titleKey: 'onboarding:goals.general_fitness.title', descriptionKey: 'onboarding:goals.general_fitness.description' },
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

export const MODES: { value: TrainingMode; labelKey: string; descriptionKey: string; icon: string; iconName: IoniconsName }[] = [
  { value: 'flexible', icon: '🌊', iconName: 'shuffle-outline',     labelKey: 'onboarding:modes.flexible.label', descriptionKey: 'onboarding:modes.flexible.description' },
  { value: 'strict',   icon: '🎯', iconName: 'lock-closed-outline', labelKey: 'onboarding:modes.strict.label',  descriptionKey: 'onboarding:modes.strict.description' },
];

export type AthleticBackground = 'none' | 'amateur' | 'high_performance' | 'bodybuilding';

export const ATHLETIC_BACKGROUNDS: { value: AthleticBackground; labelKey: string }[] = [
  { value: 'none',             labelKey: 'onboarding:step5.background.none' },
  { value: 'amateur',          labelKey: 'onboarding:step5.background.amateur' },
  { value: 'high_performance', labelKey: 'onboarding:step5.background.highPerformance' },
  { value: 'bodybuilding',     labelKey: 'onboarding:step5.background.bodybuilding' },
];

export type SupplementCode = 'creatine' | 'protein' | 'caffeine_preworkout' | 'multivitamin' | 'omega3' | 'none';

export const SUPPLEMENTS: { value: SupplementCode; labelKey: string }[] = [
  { value: 'creatine',            labelKey: 'onboarding:step5.supplements.creatine' },
  { value: 'protein',             labelKey: 'onboarding:step5.supplements.protein' },
  { value: 'caffeine_preworkout', labelKey: 'onboarding:step5.supplements.caffeine' },
  { value: 'multivitamin',        labelKey: 'onboarding:step5.supplements.multivitamin' },
  { value: 'omega3',              labelKey: 'onboarding:step5.supplements.omega3' },
  { value: 'none',                labelKey: 'onboarding:step5.supplements.none' },
];
