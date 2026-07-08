import { Stack } from 'expo-router';

// Garantiza que el hub (index) quede debajo cuando se entra directo a una
// subpantalla (p. ej. Perfil → Mi entrenamiento): back → hub → Perfil.
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function SettingsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
