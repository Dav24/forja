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
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ForjaWordmark } from '@/components/brand/ForjaWordmark';
import { useTheme } from '@/lib/theme';
import { typography } from '@/constants/typography';

export default function RegisterScreen() {
  const { t } = useTranslation('auth');
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleRegister() {
    if (!name || !email || !password) {
      Alert.alert(t('register.errors.missingFields.title'), t('register.errors.missingFields.body'));
      return;
    }
    if (password.length < 8) {
      Alert.alert(t('register.errors.passwordTooShort.title'), t('register.errors.passwordTooShort.body'));
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name }, emailRedirectTo: 'forja://' },
    });
    setLoading(false);
    if (error) {
      Alert.alert(t('register.errors.signUpFailed.title'), error.message);
    } else if (!data.session) {
      // Confirmación por correo activada: no hay sesión hasta confirmar
      setSent(true);
    }
  }

  async function handleResend() {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) Alert.alert(t('register.sent.resendError.title'), t('register.sent.resendError.body'));
    else Alert.alert(t('register.sent.resendSuccess.title'), t('register.sent.resendSuccess.body'));
  }

  if (sent) {
    return (
      <View className="flex-1 bg-background justify-center px-5 gap-4">
        <View style={{ alignSelf: 'center', width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryDim, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="mail-outline" size={32} color={colors.primary} />
        </View>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: typography.sizes.screenTitle, color: colors.text, textAlign: 'center' }}>
          {t('register.sent.title')}
        </Text>
        <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.body, color: colors.textMuted, textAlign: 'center' }}>
          {t('register.sent.bodyPre')}{'\n'}
          <Text style={{ fontFamily: 'Inter-Medium', color: colors.text }}>{email}</Text>
          {'\n\n'}{t('register.sent.bodyPost')}
        </Text>
        <Button label={t('register.sent.resend')} variant="secondary" onPress={handleResend} className="mt-4" />
        <Link href="/(auth)/login" asChild>
          <TouchableOpacity className="items-center py-3">
            <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.bodySmall, color: colors.primary }}>
              {t('register.sent.goToLogin')}
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 justify-center px-5 py-12">
          <View className="mb-10">
            <Animated.View entering={FadeIn.duration(700)} className="items-center mb-2">
              <ForjaWordmark size="lg" />
            </Animated.View>
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.body, color: colors.textMuted, textAlign: 'center', marginTop: 8 }}>
              {t('tagline')}
            </Text>
            <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: typography.sizes.screenTitle, color: colors.text, marginTop: 24 }}>
              {t('register.title')}
            </Text>
          </View>

          <View className="gap-4">
            <Input
              label={t('register.nameLabel')}
              placeholder={t('register.namePlaceholder')}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoComplete="name"
            />
            <Input
              label={t('register.emailLabel')}
              placeholder={t('register.emailPlaceholder')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <Input
              label={t('register.passwordLabel')}
              placeholder={t('register.passwordPlaceholder')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
            />
            <Button label={t('register.submit')} loading={loading} onPress={handleRegister} className="mt-2" />
          </View>

          <View className="flex-row justify-center mt-8">
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.bodySmall, color: colors.textMuted }}>
              {t('register.haveAccount')}
            </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.bodySmall, color: colors.primary, marginLeft: 4 }}>
                  {t('register.login')}
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
