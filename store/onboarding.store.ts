import { create } from 'zustand';
import type { ModalityId } from '@/constants/modalities';

type GoalType = 'weight_loss' | 'muscle_gain' | 'recomposition' | 'powerlifting' | 'sport_specific' | 'general_fitness';
type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
type FitnessLevel = 'casual' | 'intermediate' | 'intensive' | 'advanced' | 'elite';
type Mode = 'flexible' | 'strict';

interface OnboardingState {
  // Step 1
  goalType: GoalType | null;
  targetWeightKg: number | null;
  // Step 2 — modalidad
  modality: ModalityId | null;
  secondaryModalities: ModalityId[];
  sportType: string | null;
  // Step 3 — cuerpo
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  gender: Gender | null;
  activityLevel: ActivityLevel | null;
  // Step 4 — nivel
  fitnessLevel: FitnessLevel | null;
  mode: Mode;
  // Actions
  setStep1: (data: { goalType: GoalType; targetWeightKg?: number | null }) => void;
  setStep2Modality: (data: { modality: ModalityId; secondaryModalities: ModalityId[]; sportType?: string | null }) => void;
  setStep2: (data: { weightKg: number; heightCm: number; age: number; gender: Gender; activityLevel: ActivityLevel }) => void;
  setStep3: (data: { fitnessLevel: FitnessLevel; mode: Mode }) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  goalType: null,
  targetWeightKg: null,
  modality: null,
  secondaryModalities: [],
  sportType: null,
  weightKg: null,
  heightCm: null,
  age: null,
  gender: null,
  activityLevel: null,
  fitnessLevel: null,
  mode: 'flexible',
  setStep1: (data) => set({ goalType: data.goalType, targetWeightKg: data.targetWeightKg ?? null }),
  setStep2Modality: (data) =>
    set({
      modality: data.modality,
      secondaryModalities: data.secondaryModalities,
      sportType: data.sportType ?? null,
    }),
  setStep2: (data) => set(data),
  setStep3: (data) => set(data),
  reset: () => set({
    goalType: null, targetWeightKg: null,
    modality: null, secondaryModalities: [], sportType: null,
    weightKg: null, heightCm: null, age: null, gender: null, activityLevel: null,
    fitnessLevel: null, mode: 'flexible',
  }),
}));
