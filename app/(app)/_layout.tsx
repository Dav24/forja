import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSyncLanguage } from '@/hooks/useSyncLanguage';
import { PillTabBar } from '@/components/nav/PillTabBar';

export default function AppLayout() {
  const { t } = useTranslation('common');
  useSyncLanguage();

  return (
    <Tabs
      // Sin esto, back() desde un tab (p. ej. salir de Ajustes) cae al primer
      // tab (dashboard) en vez de regresar al tab desde el que se navegó (Perfil).
      backBehavior="history"
      tabBar={(props) => <PillTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="chat" options={{ title: t('tabs.coach') }} />
      <Tabs.Screen name="plans" options={{ title: t('tabs.plans') }} />
      <Tabs.Screen name="progress" options={{ title: t('tabs.progress') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
      <Tabs.Screen name="upgrade" options={{ href: null }} />
      <Tabs.Screen name="success" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
