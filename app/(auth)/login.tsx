import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StaggerIn } from '@/components/ui/StaggerIn';
import { ForjaWordmark } from '@/components/brand/ForjaWordmark';
import { HeroGlow } from '@/components/brand/HeroGlow';
import { useTheme } from '@/lib/theme';
import { typography } from '@/constants/typography';

export default function LoginScreen() {
  const { t } = useTranslation('auth');
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert(t('login.errors.missingFields.title'), t('login.errors.missingFields.body'));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        Alert.alert(
          t('login.confirmEmail.title'),
          t('login.confirmEmail.body'),
          [
            { text: t('login.confirmEmail.cancel'), style: 'cancel' },
            {
              text: t('login.confirmEmail.resend'),
              onPress: async () => {
                const { error: resendErr } = await supabase.auth.resend({ type: 'signup', email });
                Alert.alert(
                  resendErr ? t('login.confirmEmail.resendError.title') : t('login.confirmEmail.resendSuccess.title'),
                  resendErr ? t('login.confirmEmail.resendError.body') : t('login.confirmEmail.resendSuccess.body')
                );
              },
            },
          ]
        );
      } else {
        Alert.alert(t('login.errors.signInFailed.title'), error.message);
      }
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 justify-center px-5 py-12">
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <HeroGlow />
            <Animated.View entering={FadeIn.duration(700)}>
              <ForjaWordmark size="lg" />
            </Animated.View>
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.body, color: colors.textMuted, textAlign: 'center', marginTop: 8 }}>
              {t('tagline')}
            </Text>
          </View>

          <StaggerIn index={0}>
            <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: typography.sizes.screenTitle, color: colors.text, marginBottom: 20 }}>
              {t('login.title')}
            </Text>
          </StaggerIn>

          <StaggerIn index={1}>
            <View
              style={{
                backgroundColor: colors.surfaceElevated,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 20,
                gap: 16,
              }}
            >
              <Input
                leftIcon="mail-outline"
                label={t('login.emailLabel')}
                placeholder={t('login.emailPlaceholder')}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
              <Input
                leftIcon="lock-closed-outline"
                label={t('login.passwordLabel')}
                placeholder={t('login.passwordPlaceholder')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
              />

              <Link href="/(auth)/forgot-password" asChild>
                <TouchableOpacity className="self-end">
                  <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.bodySmall, color: colors.accent }}>
                    {t('login.forgotPassword')}
                  </Text>
                </TouchableOpacity>
              </Link>

              <Button label={t('login.submit')} loading={loading} onPress={handleLogin} className="mt-2" />
            </View>
          </StaggerIn>

          <View className="flex-row justify-center mt-8">
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.bodySmall, color: colors.textMuted }}>
              {t('login.noAccount')}
            </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.bodySmall, color: colors.primary, marginLeft: 4 }}>
                  {t('login.createAccount')}
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
