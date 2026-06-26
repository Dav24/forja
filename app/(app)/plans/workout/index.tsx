import { Redirect } from 'expo-router';

// La lista de planes se maneja desde el hub /(app)/plans/index.tsx
export default function WorkoutPlansIndex() {
  return <Redirect href="/(app)/plans" />;
}
