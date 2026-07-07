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
  label: string;
  icon: string;
  description: string;
  equipmentPresets: string[];
}

export const MODALITIES: Modality[] = [
  {
    id: 'gym_strength',
    label: 'Fuerza / Gym',
    icon: '🏋️',
    description: 'Pesas, máquinas y fuerza en el gimnasio',
    equipmentPresets: ['Gimnasio completo', 'Gimnasio básico'],
  },
  {
    id: 'functional',
    label: 'Funcional / CrossFit / HIIT',
    icon: '⚡',
    description: 'Circuitos, WODs e intervalos de alta intensidad',
    equipmentPresets: ['Box completo', 'Kettlebells y cuerdas', 'Sin equipo'],
  },
  {
    id: 'endurance',
    label: 'Cardio de resistencia',
    icon: '🏃',
    description: 'Correr, caminar o caminadora',
    equipmentPresets: ['Aire libre', 'Caminadora'],
  },
  {
    id: 'cycling',
    label: 'Ciclismo / Spinning',
    icon: '🚴',
    description: 'Ruta, bici fija o rodillo',
    equipmentPresets: ['Bici de ruta', 'Bici fija / spinning', 'Rodillo'],
  },
  {
    id: 'swimming',
    label: 'Natación',
    icon: '🏊',
    description: 'Entrenamiento en alberca',
    equipmentPresets: ['Alberca corta (25m)', 'Alberca larga (50m)'],
  },
  {
    id: 'home_calisthenics',
    label: 'En casa / Calistenia',
    icon: '🏠',
    description: 'Peso corporal y equipo mínimo en casa',
    equipmentPresets: ['Sin equipo', 'Bandas', 'Mancuernas', 'Barra de dominadas'],
  },
  {
    id: 'mobility',
    label: 'Yoga / Pilates / Movilidad',
    icon: '🧘',
    description: 'Flexibilidad, control y movilidad',
    equipmentPresets: ['Tapete', 'Tapete y bloques'],
  },
  {
    id: 'ball_sports',
    label: 'Deportes con balón',
    icon: '⚽',
    description: 'Fútbol, básquet, tenis y más',
    equipmentPresets: ['Cancha y balón'],
  },
];
