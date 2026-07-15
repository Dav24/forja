-- Objetivos concretos por disciplina: rama de orientación + texto libre,
-- y 9ª modalidad "Primeros pasos" para principiantes absolutos.

alter table goals add column modality_orientation text;
alter table goals add column modality_goal_notes text;
alter table goals add column secondary_goal_notes text;

alter table goals add constraint goals_modality_orientation_check check (
  modality_orientation is null or modality_orientation in (
    'gym_strength_hypertrophy','gym_strength_max_strength','gym_strength_competition_prep','gym_strength_maintenance',
    'functional_hyrox_prep','functional_wod_times','functional_general_conditioning','functional_variety_only',
    'endurance_first_5k','endurance_short_distance_time','endurance_half_full_marathon','endurance_general_cardio',
    'cycling_start_long_distance','cycling_speed_power','cycling_competition_gran_fondo','cycling_general_cardio',
    'swimming_nonstop','swimming_technique','swimming_distance_time','swimming_competition_triathlon',
    'home_calisthenics_basics','home_calisthenics_advanced_skills','home_calisthenics_weight_loss_no_equipment','home_calisthenics_stay_active',
    'mobility_general_flexibility','mobility_injury_rehab','mobility_pain_tension','mobility_complement',
    'ball_sports_performance','ball_sports_season_prep','ball_sports_fun_fitness','ball_sports_injury_recovery',
    'first_steps_never_trained','first_steps_event_date','first_steps_energy_health','first_steps_just_move'
  )
);

-- 9ª modalidad "Primeros pasos"
alter table goals drop constraint goals_modality_check;
alter table goals add constraint goals_modality_check check (
  modality is null or modality in (
    'gym_strength','functional','endurance','cycling',
    'swimming','home_calisthenics','mobility','ball_sports','first_steps'
  )
);
