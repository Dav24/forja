import { useEffect } from 'react';
import { router } from 'expo-router';

export default function MealPlanDetail() {
  useEffect(() => {
    router.replace('/(app)/plans/meal');
  }, []);
  return null;
}
