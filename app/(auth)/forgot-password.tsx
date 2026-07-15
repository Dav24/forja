import { useState } from 'react';
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { typography } from '@/constants/typography';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

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
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primaryDim, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Ionicons name="checkmark-circle" size={32} color={colors.primary} />
        </View>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: typography.sizes.screenTitle, color: colors.text, marginBottom: 8 }}>
          {t('forgotPassword.sent.title')}
        </Text>
        <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.body, color: colors.textMuted, marginBottom: 32 }}>
          {t('forgotPassword.sent.body', { email })}
        </Text>
        <Button label={t('forgotPassword.sent.backToLogin')} variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 justify-center px-5">
        <TouchableOpacity className="mb-8 self-start flex-row items-center gap-1.5" onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={colors.accent} />
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.body, color: colors.accent }}>
            {t('forgotPassword.back')}
          </Text>
        </TouchableOpacity>

        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: typography.sizes.screenTitle, color: colors.text, marginBottom: 8 }}>
          {t('forgotPassword.title')}
        </Text>
        <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.body, color: colors.textMuted, marginBottom: 32 }}>
          {t('forgotPassword.body')}
        </Text>

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
            label={t('forgotPassword.emailLabel')}
            placeholder={t('forgotPassword.emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Button label={t('forgotPassword.submit')} loading={loading} onPress={handleReset} className="mt-2" />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
