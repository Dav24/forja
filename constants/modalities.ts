import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

export type ModalityId =
  | 'gym_strength'
  | 'functional'
  | 'endurance'
  | 'cycling'
  | 'swimming'
  | 'home_calisthenics'
  | 'mobility'
  | 'ball_sports'
  | 'first_steps';

export interface Modality {
  id: ModalityId;
  labelKey: string;
  icon: string;
  iconName: IoniconsName;
  descriptionKey: string;
  /** Claves i18n (onboarding:modalities.<id>.presets.<n>) — resolver con t() */
  equipmentPresets: string[];
}

export const MODALITIES: Modality[] = [
  {
    id: 'gym_strength',
    labelKey: 'onboarding:modalities.gym_strength.label',
    icon: '🏋️',
    iconName: 'barbell-outline',
    descriptionKey: 'onboarding:modalities.gym_strength.description',
    equipmentPresets: ['onboarding:modalities.gym_strength.presets.0', 'onboarding:modalities.gym_strength.presets.1'],
  },
  {
    id: 'functional',
    labelKey: 'onboarding:modalities.functional.label',
    icon: '⚡',
    iconName: 'flash-outline',
    descriptionKey: 'onboarding:modalities.functional.description',
    equipmentPresets: ['onboarding:modalities.functional.presets.0', 'onboarding:modalities.functional.presets.1', 'onboarding:modalities.functional.presets.2'],
  },
  {
    id: 'endurance',
    labelKey: 'onboarding:modalities.endurance.label',
    icon: '🏃',
    iconName: 'walk-outline',
    descriptionKey: 'onboarding:modalities.endurance.description',
    equipmentPresets: ['onboarding:modalities.endurance.presets.0', 'onboarding:modalities.endurance.presets.1'],
  },
  {
    id: 'cycling',
    labelKey: 'onboarding:modalities.cycling.label',
    icon: '🚴',
    iconName: 'bicycle-outline',
    descriptionKey: 'onboarding:modalities.cycling.description',
    equipmentPresets: ['onboarding:modalities.cycling.presets.0', 'onboarding:modalities.cycling.presets.1', 'onboarding:modalities.cycling.presets.2'],
  },
  {
    id: 'swimming',
    labelKey: 'onboarding:modalities.swimming.label',
    icon: '🏊',
    iconName: 'water-outline',
    descriptionKey: 'onboarding:modalities.swimming.description',
    equipmentPresets: ['onboarding:modalities.swimming.presets.0', 'onboarding:modalities.swimming.presets.1'],
  },
  {
    id: 'home_calisthenics',
    labelKey: 'onboarding:modalities.home_calisthenics.label',
    icon: '🏠',
    iconName: 'home-outline',
    descriptionKey: 'onboarding:modalities.home_calisthenics.description',
    equipmentPresets: ['onboarding:modalities.home_calisthenics.presets.0', 'onboarding:modalities.home_calisthenics.presets.1', 'onboarding:modalities.home_calisthenics.presets.2', 'onboarding:modalities.home_calisthenics.presets.3'],
  },
  {
    id: 'mobility',
    labelKey: 'onboarding:modalities.mobility.label',
    icon: '🧘',
    iconName: 'body-outline',
    descriptionKey: 'onboarding:modalities.mobility.description',
    equipmentPresets: ['onboarding:modalities.mobility.presets.0', 'onboarding:modalities.mobility.presets.1'],
  },
  {
    id: 'ball_sports',
    labelKey: 'onboarding:modalities.ball_sports.label',
    icon: '⚽',
    iconName: 'football-outline',
    descriptionKey: 'onboarding:modalities.ball_sports.description',
    equipmentPresets: ['onboarding:modalities.ball_sports.presets.0'],
  },
  {
    id: 'first_steps',
    labelKey: 'onboarding:modalities.first_steps.label',
    icon: '🌱',
    iconName: 'leaf-outline',
    descriptionKey: 'onboarding:modalities.first_steps.description',
    equipmentPresets: ['onboarding:modalities.first_steps.presets.0'],
  },
];
