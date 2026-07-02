import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useUpdateProfile } from '@/hooks/useProfile';

type NotificationsModule = typeof import('expo-notifications');
const isExpoGo = Constants.appOwnership === 'expo';
const Notifications: NotificationsModule | null = isExpoGo
  ? null
  : (() => { try { return require('expo-notifications') as NotificationsModule; } catch { return null; } })();

export function useNotifications(): void {
  const { user } = useAuthStore();
  const { mutate: updateProfile } = useUpdateProfile();

  useEffect(() => {
    if (!Notifications) return;
    if (!user) return;
    if (!Device.isDevice) return; // skip simulators

    // Capturar en const local: TS no puede narrar el null a través de la función anidada
    const N = Notifications;

    async function register() {
      try {
        if (Platform.OS === 'android') {
          await N.setNotificationChannelAsync('default', {
            name: 'Forja',
            importance: N.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
          });
        }

        const { status: existing } = await N.getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== 'granted') {
          const { status } = await N.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') return;

        const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
        if (!projectId) return; // requires eas init + extra.eas.projectId in app.json
        const { data: token } = await N.getExpoPushTokenAsync({ projectId });
        if (!token) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('expo_push_token')
          .eq('id', user!.id)
          .single();

        if (profile?.expo_push_token !== token) {
          updateProfile({ expo_push_token: token });
        }
      } catch {
        // notifications are optional — never crash the app
      }
    }

    register();
  }, [user?.id]);
}
