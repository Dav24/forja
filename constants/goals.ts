export type GoalType =
  | 'weight_loss' | 'muscle_gain' | 'recomposition'
  | 'powerlifting' | 'sport_specific' | 'general_fitness';

export const GOALS: { type: GoalType; icon: string; title: string; description: string }[] = [
  { type: 'weight_loss',     icon: '🔥', title: 'Bajar de peso',      description: 'Perder grasa y mejorar composición corporal' },
  { type: 'muscle_gain',     icon: '💪', title: 'Ganar músculo',       description: 'Aumentar masa muscular y fuerza' },
  { type: 'recomposition',   icon: '⚡', title: 'Recomposición',       description: 'Perder grasa y ganar músculo simultáneamente' },
  { type: 'powerlifting',    icon: '🏋️', title: 'Powerlifting',        description: 'Maximizar fuerza en sentadilla, press y peso muerto' },
  { type: 'sport_specific',  icon: '🏃', title: 'Deporte específico',  description: 'Rendimiento para tu deporte o disciplina' },
  { type: 'general_fitness', icon: '✨', title: 'Fitness general',     description: 'Mejorar salud, energía y bienestar general' },
];

export type FitnessLevel = 'casual' | 'intermediate' | 'intensive' | 'advanced' | 'elite';

export const FITNESS_LEVELS: { value: FitnessLevel; label: string; description: string }[] = [
  { value: 'casual',       label: 'Casual',     description: 'Entreno esporádicamente o soy principiante' },
  { value: 'intermediate', label: 'Intermedio', description: 'Entreno regularmente desde hace meses' },
  { value: 'intensive',    label: 'Intensivo',  description: 'Entreno con seriedad, varias veces a la semana' },
  { value: 'advanced',     label: 'Avanzado',   description: 'Años de entrenamiento consistente' },
  { value: 'elite',        label: 'Élite',      description: 'Atleta competitivo o de alto rendimiento' },
];

export type TrainingMode = 'flexible' | 'strict';

export const MODES: { value: TrainingMode; label: string; description: string; icon: string }[] = [
  { value: 'flexible', icon: '🌊', label: 'Flexible', description: 'Me adapto cuando la vida se complica. Prefiero consistencia a perfección.' },
  { value: 'strict',   icon: '🎯', label: 'Estricto', description: 'Me comprometo al 100%. Sin excusas, sin saltarme sesiones.' },
];
