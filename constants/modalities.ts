export type ModalityId =
  | 'gym_strength'
  | 'functional'
  | 'endurance'
  | 'cycling'
  | 'swimming'
  | 'home_calisthenics'
  | 'mobility'
  | 'ball_sports';

export interface Modality {
  id: ModalityId;
  labelKey: string;
  icon: string;
  descriptionKey: string;
  equipmentPresets: string[];
}

export const MODALITIES: Modality[] = [
  {
    id: 'gym_strength',
    labelKey: 'onboarding:modalities.gym_strength.label',
    icon: '🏋️',
    descriptionKey: 'onboarding:modalities.gym_strength.description',
    equipmentPresets: ['Gimnasio completo', 'Gimnasio básico'],
  },
  {
    id: 'functional',
    labelKey: 'onboarding:modalities.functional.label',
    icon: '⚡',
    descriptionKey: 'onboarding:modalities.functional.description',
    equipmentPresets: ['Box completo', 'Kettlebells y cuerdas', 'Sin equipo'],
  },
  {
    id: 'endurance',
    labelKey: 'onboarding:modalities.endurance.label',
    icon: '🏃',
    descriptionKey: 'onboarding:modalities.endurance.description',
    equipmentPresets: ['Aire libre', 'Caminadora'],
  },
  {
    id: 'cycling',
    labelKey: 'onboarding:modalities.cycling.label',
    icon: '🚴',
    descriptionKey: 'onboarding:modalities.cycling.description',
    equipmentPresets: ['Bici de ruta', 'Bici fija / spinning', 'Rodillo'],
  },
  {
    id: 'swimming',
    labelKey: 'onboarding:modalities.swimming.label',
    icon: '🏊',
    descriptionKey: 'onboarding:modalities.swimming.description',
    equipmentPresets: ['Alberca corta (25m)', 'Alberca larga (50m)'],
  },
  {
    id: 'home_calisthenics',
    labelKey: 'onboarding:modalities.home_calisthenics.label',
    icon: '🏠',
    descriptionKey: 'onboarding:modalities.home_calisthenics.description',
    equipmentPresets: ['Sin equipo', 'Bandas', 'Mancuernas', 'Barra de dominadas'],
  },
  {
    id: 'mobility',
    labelKey: 'onboarding:modalities.mobility.label',
    icon: '🧘',
    descriptionKey: 'onboarding:modalities.mobility.description',
    equipmentPresets: ['Tapete', 'Tapete y bloques'],
  },
  {
    id: 'ball_sports',
    labelKey: 'onboarding:modalities.ball_sports.label',
    icon: '⚽',
    descriptionKey: 'onboarding:modalities.ball_sports.description',
    equipmentPresets: ['Cancha y balón'],
  },
];
