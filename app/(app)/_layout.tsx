import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '@/constants/colors';
import { useSyncLanguage } from '@/hooks/useSyncLanguage';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused }: { name: IoniconsName; focused: boolean }) {
  return (
    <Ionicons
      name={name}
      size={24}
      color={focused ? colors.primary : colors.textMuted}
    />
  );
}

export default function AppLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('common');
  useSyncLanguage();

  return (
    <Tabs
      // Sin esto, back() desde un tab (p. ej. salir de Ajustes) cae al primer
      // tab (dashboard) en vez de regresar al tab desde el que se navegó (Perfil).
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontFamily: 'Inter-Medium', marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t('tabs.coach'),
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          title: t('tabs.plans'),
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'barbell' : 'barbell-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: t('tabs.progress'),
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'trending-up' : 'trending-up-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'person' : 'person-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="upgrade"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="success"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="settings"
        options={{ href: null }}
      />
    </Tabs>
  );
}
