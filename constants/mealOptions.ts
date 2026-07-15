// Opciones del formulario de plan alimenticio.
// `value` es el valor canónico que espera la EF generate-meal-plan
// (VALID_DIETS / VALID_AVAILABILITY validan en español — no traducir).
// La label visible se resuelve con t(labelKey).
export interface MealOption {
  value: string;
  labelKey: string;
}

export const DIET_OPTIONS: MealOption[] = [
  { value: 'Omnívoro', labelKey: 'plans:meal.form.diet.omnivore' },
  { value: 'Vegetariano', labelKey: 'plans:meal.form.diet.vegetarian' },
  { value: 'Vegano', labelKey: 'plans:meal.form.diet.vegan' },
  { value: 'Sin gluten', labelKey: 'plans:meal.form.diet.glutenFree' },
  { value: 'Keto', labelKey: 'plans:meal.form.diet.keto' },
];

export const AVAILABILITY_OPTIONS: MealOption[] = [
  { value: 'Básica', labelKey: 'plans:meal.form.availability.basic' },
  { value: 'Media', labelKey: 'plans:meal.form.availability.medium' },
  { value: 'Amplia', labelKey: 'plans:meal.form.availability.wide' },
];
