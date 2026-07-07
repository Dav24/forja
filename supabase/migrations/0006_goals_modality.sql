-- Modalidad de entrenamiento del usuario (mini-paso multi-modalidad)
-- Principal define el plan generado; secundarias se integran cuando los días lo permiten.
alter table goals add column modality text;
alter table goals add column secondary_modalities text[] not null default '{}';

alter table goals add constraint goals_modality_check check (
  modality is null or modality in (
    'gym_strength','functional','endurance','cycling',
    'swimming','home_calisthenics','mobility','ball_sports'
  )
);

alter table goals add constraint goals_secondary_modalities_check check (
  coalesce(array_length(secondary_modalities, 1), 0) <= 2
);
