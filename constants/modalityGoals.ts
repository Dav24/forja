import type { ModalityId } from '@/constants/modalities';

export interface ModalityGoalBranch {
  id: string;
  labelKey: string;
}

export const MODALITY_GOAL_BRANCHES: Record<ModalityId, ModalityGoalBranch[]> = {
  gym_strength: [
    { id: 'gym_strength_hypertrophy', labelKey: 'onboarding:modalityGoals.gym_strength_hypertrophy' },
    { id: 'gym_strength_max_strength', labelKey: 'onboarding:modalityGoals.gym_strength_max_strength' },
    { id: 'gym_strength_competition_prep', labelKey: 'onboarding:modalityGoals.gym_strength_competition_prep' },
    { id: 'gym_strength_maintenance', labelKey: 'onboarding:modalityGoals.gym_strength_maintenance' },
  ],
  functional: [
    { id: 'functional_hyrox_prep', labelKey: 'onboarding:modalityGoals.functional_hyrox_prep' },
    { id: 'functional_wod_times', labelKey: 'onboarding:modalityGoals.functional_wod_times' },
    { id: 'functional_general_conditioning', labelKey: 'onboarding:modalityGoals.functional_general_conditioning' },
    { id: 'functional_variety_only', labelKey: 'onboarding:modalityGoals.functional_variety_only' },
  ],
  endurance: [
    { id: 'endurance_first_5k', labelKey: 'onboarding:modalityGoals.endurance_first_5k' },
    { id: 'endurance_short_distance_time', labelKey: 'onboarding:modalityGoals.endurance_short_distance_time' },
    { id: 'endurance_half_full_marathon', labelKey: 'onboarding:modalityGoals.endurance_half_full_marathon' },
    { id: 'endurance_general_cardio', labelKey: 'onboarding:modalityGoals.endurance_general_cardio' },
  ],
  cycling: [
    { id: 'cycling_start_long_distance', labelKey: 'onboarding:modalityGoals.cycling_start_long_distance' },
    { id: 'cycling_speed_power', labelKey: 'onboarding:modalityGoals.cycling_speed_power' },
    { id: 'cycling_competition_gran_fondo', labelKey: 'onboarding:modalityGoals.cycling_competition_gran_fondo' },
    { id: 'cycling_general_cardio', labelKey: 'onboarding:modalityGoals.cycling_general_cardio' },
  ],
  swimming: [
    { id: 'swimming_nonstop', labelKey: 'onboarding:modalityGoals.swimming_nonstop' },
    { id: 'swimming_technique', labelKey: 'onboarding:modalityGoals.swimming_technique' },
    { id: 'swimming_distance_time', labelKey: 'onboarding:modalityGoals.swimming_distance_time' },
    { id: 'swimming_competition_triathlon', labelKey: 'onboarding:modalityGoals.swimming_competition_triathlon' },
  ],
  home_calisthenics: [
    { id: 'home_calisthenics_basics', labelKey: 'onboarding:modalityGoals.home_calisthenics_basics' },
    { id: 'home_calisthenics_advanced_skills', labelKey: 'onboarding:modalityGoals.home_calisthenics_advanced_skills' },
    { id: 'home_calisthenics_weight_loss_no_equipment', labelKey: 'onboarding:modalityGoals.home_calisthenics_weight_loss_no_equipment' },
    { id: 'home_calisthenics_stay_active', labelKey: 'onboarding:modalityGoals.home_calisthenics_stay_active' },
  ],
  mobility: [
    { id: 'mobility_general_flexibility', labelKey: 'onboarding:modalityGoals.mobility_general_flexibility' },
    { id: 'mobility_injury_rehab', labelKey: 'onboarding:modalityGoals.mobility_injury_rehab' },
    { id: 'mobility_pain_tension', labelKey: 'onboarding:modalityGoals.mobility_pain_tension' },
    { id: 'mobility_complement', labelKey: 'onboarding:modalityGoals.mobility_complement' },
  ],
  ball_sports: [
    { id: 'ball_sports_performance', labelKey: 'onboarding:modalityGoals.ball_sports_performance' },
    { id: 'ball_sports_season_prep', labelKey: 'onboarding:modalityGoals.ball_sports_season_prep' },
    { id: 'ball_sports_fun_fitness', labelKey: 'onboarding:modalityGoals.ball_sports_fun_fitness' },
    { id: 'ball_sports_injury_recovery', labelKey: 'onboarding:modalityGoals.ball_sports_injury_recovery' },
  ],
  first_steps: [
    { id: 'first_steps_never_trained', labelKey: 'onboarding:modalityGoals.first_steps_never_trained' },
    { id: 'first_steps_event_date', labelKey: 'onboarding:modalityGoals.first_steps_event_date' },
    { id: 'first_steps_energy_health', labelKey: 'onboarding:modalityGoals.first_steps_energy_health' },
    { id: 'first_steps_just_move', labelKey: 'onboarding:modalityGoals.first_steps_just_move' },
  ],
};
