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
  targetDate: string | null;
  // Step 2 — modalidad
  modality: ModalityId | null;
  secondaryModalities: ModalityId[];
  sportType: string | null;
  modalityOrientation: string | null;
  modalityGoalNotes: string | null;
  secondaryGoalNotes: string | null;
  // Step 3 — cuerpo
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  gender: Gender | null;
  activityLevel: ActivityLevel | null;
  // Step 4 — nivel
  fitnessLevel: FitnessLevel | null;
  mode: Mode;
  // Step 4 → 5 — id del goal recién insertado, para que el paso 5 lo actualice
  goalId: string | null;
  // Actions
  setStep1: (data: { goalType: GoalType; targetWeightKg?: number | null; targetDate?: string | null }) => void;
  setStep2Modality: (data: {
    modality: ModalityId;
    secondaryModalities: ModalityId[];
    sportType?: string | null;
    modalityOrientation?: string | null;
    modalityGoalNotes?: string | null;
    secondaryGoalNotes?: string | null;
  }) => void;
  setStep2: (data: { weightKg: number; heightCm: number; age: number; gender: Gender; activityLevel: ActivityLevel }) => void;
  setStep3: (data: { fitnessLevel: FitnessLevel; mode: Mode }) => void;
  setGoalId: (goalId: string) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  goalType: null,
  targetWeightKg: null,
  targetDate: null,
  modality: null,
  secondaryModalities: [],
  sportType: null,
  modalityOrientation: null,
  modalityGoalNotes: null,
  secondaryGoalNotes: null,
  weightKg: null,
  heightCm: null,
  age: null,
  gender: null,
  activityLevel: null,
  fitnessLevel: null,
  mode: 'flexible',
  goalId: null,
  setStep1: (data) => set({
    goalType: data.goalType,
    targetWeightKg: data.targetWeightKg ?? null,
    targetDate: data.targetDate ?? null,
  }),
  setStep2Modality: (data) =>
    set({
      modality: data.modality,
      secondaryModalities: data.secondaryModalities,
      sportType: data.sportType ?? null,
      modalityOrientation: data.modalityOrientation ?? null,
      modalityGoalNotes: data.modalityGoalNotes ?? null,
      secondaryGoalNotes: data.secondaryGoalNotes ?? null,
    }),
  setStep2: (data) => set(data),
  setStep3: (data) => set(data),
  setGoalId: (goalId) => set({ goalId }),
  reset: () => set({
    goalType: null, targetWeightKg: null, targetDate: null,
    modality: null, secondaryModalities: [], sportType: null,
    modalityOrientation: null, modalityGoalNotes: null, secondaryGoalNotes: null,
    weightKg: null, heightCm: null, age: null, gender: null, activityLevel: null,
    fitnessLevel: null, mode: 'flexible', goalId: null,
  }),
}));
