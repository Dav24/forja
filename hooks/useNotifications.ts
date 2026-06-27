import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useUpdateProfile } from '@/hooks/useProfile';

export function useNotifications(): void {
  const { user } = useAuthStore();
  const { mutate: updateProfile } = useUpdateProfile();

  useEffect(() => {
    if (!user) return;
    if (!Device.isDevice) return; // skip simulators

    async function register() {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Forja',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
          });
        }

        const { status: existing } = await Notifications.getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') return;

        const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
        const { data: token } = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : {}
        );
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
