import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation('auth');
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const router = useRouter();

  async function handleReset() {
    if (!email) {
      Alert.alert(t('forgotPassword.errors.missingEmail.title'), t('forgotPassword.errors.missingEmail.body'));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'forja://reset-password',
    });
    setLoading(false);
    if (error) {
      Alert.alert(t('forgotPassword.errors.resetFailed.title'), error.message);
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <View className="flex-1 bg-background justify-center px-5">
        <Text className="text-primary text-5xl mb-4">✓</Text>
        <Text className="text-text font-bold text-2xl mb-2">{t('forgotPassword.sent.title')}</Text>
        <Text className="text-text-muted text-base mb-8">
          {t('forgotPassword.sent.body', { email })}
        </Text>
        <TouchableOpacity
          className="bg-surface border border-border rounded-xl h-14 items-center justify-center"
          onPress={() => router.back()}
        >
          <Text className="text-text font-semibold text-base">{t('forgotPassword.sent.backToLogin')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 justify-center px-5">
        <TouchableOpacity className="mb-8 self-start" onPress={() => router.back()}>
          <Text className="text-accent text-base">{t('forgotPassword.back')}</Text>
        </TouchableOpacity>

        <Text className="text-text font-bold text-3xl mb-2">{t('forgotPassword.title')}</Text>
        <Text className="text-text-muted text-base mb-8">
          {t('forgotPassword.body')}
        </Text>

        <View className="gap-4">
          <View>
            <Text className="text-text text-sm font-medium mb-2">{t('forgotPassword.emailLabel')}</Text>
            <TextInput
              className="bg-surface border border-border rounded-xl px-4 h-14 text-text text-base"
              placeholder={t('forgotPassword.emailPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <TouchableOpacity
            className="bg-primary rounded-xl h-14 items-center justify-center mt-2"
            onPress={handleReset}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={colors.background} />
              : <Text className="text-background font-bold text-base">{t('forgotPassword.submit')}</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
