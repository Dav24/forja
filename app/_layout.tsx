import '@/lib/i18n';
import '../global.css';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import {
  Inter_400Regular,
  Inter_500Medium,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import * as SplashScreen from 'expo-splash-screen';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { ThemeProvider } from '@/lib/theme';
import { useAuthStore } from '@/store/auth.store';
import { useProfileStore } from '@/store/profile.store';
import { useNotifications } from '@/hooks/useNotifications';

SplashScreen.preventAutoHideAsync();

const isExpoGo = Constants.appOwnership === 'expo';

// expo-notifications crashes on import in Expo Go SDK 53+; require conditionally
type NotificationsModule = typeof import('expo-notifications');
const Notifications: NotificationsModule | null = isExpoGo
  ? null
  : (() => { try { return require('expo-notifications') as NotificationsModule; } catch { return null; } })();

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1 },
  },
});

function AuthGuard() {
  const { session, isLoading, setSession, setIsLoading } = useAuthStore();
  const { onboardingCompleted, setOnboardingCompleted, setDisplayName } = useProfileStore();
  useNotifications();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_completed, display_name')
          .eq('id', session.user.id)
          .single();
        setOnboardingCompleted(profile?.onboarding_completed ?? false);
        if (profile?.display_name) setDisplayName(profile.display_name);
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_completed, display_name')
          .eq('id', session.user.id)
          .single();
        setOnboardingCompleted(profile?.onboarding_completed ?? false);
        if (profile?.display_name) setDisplayName(profile.display_name);
      } else {
        setOnboardingCompleted(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (session && onboardingCompleted === null) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = pathname.includes('onboarding');

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && !onboardingCompleted && !inOnboarding) {
      router.replace('/(auth)/onboarding/step-1-goals');
    } else if (session && onboardingCompleted && inAuthGroup) {
      router.replace('/(app)');
    }
  }, [session, isLoading, onboardingCompleted, segments, pathname]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'SpaceGrotesk-Regular': SpaceGrotesk_400Regular,
    'SpaceGrotesk-SemiBold': SpaceGrotesk_600SemiBold,
    'SpaceGrotesk-Bold': SpaceGrotesk_700Bold,
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'JetBrainsMono-Regular': JetBrainsMono_400Regular,
    'JetBrainsMono-Medium': JetBrainsMono_500Medium,
    'BebasNeue-Regular': BebasNeue_400Regular,
  });
  const router = useRouter();

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!Notifications) return;
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const type = response.notification.request.content.data?.type as string | undefined;
      if (type === 'goal_milestone') {
        router.push('/(app)/progress');
      } else if (type === 'plan_ready') {
        router.push('/(app)/plans');
      } else {
        router.push('/(app)');
      }
    });
    return () => subscription.remove();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthGuard />
          <Stack screenOptions={{ headerShown: false }} />
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
