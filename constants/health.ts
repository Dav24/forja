export type BodyArea =
  | 'rodilla' | 'hombro' | 'espalda_baja' | 'cadera' | 'tobillo' | 'muñeca' | 'cuello' | 'otro';

export const BODY_AREAS: { value: BodyArea; labelKey: string }[] = [
  { value: 'rodilla',      labelKey: 'health:bodyAreas.rodilla' },
  { value: 'hombro',       labelKey: 'health:bodyAreas.hombro' },
  { value: 'espalda_baja', labelKey: 'health:bodyAreas.espaldaBaja' },
  { value: 'cadera',       labelKey: 'health:bodyAreas.cadera' },
  { value: 'tobillo',      labelKey: 'health:bodyAreas.tobillo' },
  { value: 'muñeca',       labelKey: 'health:bodyAreas.muneca' },
  { value: 'cuello',       labelKey: 'health:bodyAreas.cuello' },
  { value: 'otro',         labelKey: 'health:bodyAreas.otro' },
];

export type InjurySeverity = 'leve_moderada' | 'severa_estructural';

export const INJURY_SEVERITIES: { value: InjurySeverity; labelKey: string; descriptionKey: string }[] = [
  { value: 'leve_moderada',     labelKey: 'health:severities.leveModerada.label',     descriptionKey: 'health:severities.leveModerada.description' },
  { value: 'severa_estructural', labelKey: 'health:severities.severaEstructural.label', descriptionKey: 'health:severities.severaEstructural.description' },
];

export type MedicalConditionCode =
  | 'diabetes' | 'hipertension' | 'bypass_gastrico' | 'embarazo' | 'enfermedad_renal' | 'otro';

export const MEDICAL_CONDITIONS: { value: MedicalConditionCode; labelKey: string }[] = [
  { value: 'diabetes',         labelKey: 'health:conditions.diabetes' },
  { value: 'hipertension',     labelKey: 'health:conditions.hipertension' },
  { value: 'bypass_gastrico',  labelKey: 'health:conditions.bypassGastrico' },
  { value: 'embarazo',         labelKey: 'health:conditions.embarazo' },
  { value: 'enfermedad_renal', labelKey: 'health:conditions.enfermedadRenal' },
  { value: 'otro',             labelKey: 'health:conditions.otro' },
];
