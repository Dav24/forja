import { useState, useEffect } from 'react';
import { Alert, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { useAvatarUpload } from '@/hooks/useAvatarUpload';
import { SettingsGroup, SettingsRow } from '@/components/settings/SettingsRow';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { colors } from '@/constants/colors';

export default function AccountScreen() {
  const { t } = useTranslation('settings');

  function friendlyAuthError(message: string): string {
    const m = message.toLowerCase();
    if (m.includes('already registered') || m.includes('already been registered')) return t('account.errors.emailInUse');
    if (m.includes('password should be')) return t('account.errors.passwordShort');
    if (m.includes('rate limit')) return t('account.errors.rateLimit');
    return t('account.errors.generic');
  }

  const { user } = useAuthStore();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const { pickAndUpload, uploading, error: avatarError, permissionDenied } = useAvatarUpload();

  const [name, setName] = useState(profile?.display_name ?? '');
  const [nameTouched, setNameTouched] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'saving' | 'sent'>('idle');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const [passStatus, setPassStatus] = useState<'idle' | 'saving' | 'done'>('idle');
  const [passError, setPassError] = useState<string | null>(null);

  useEffect(() => {
    if (!nameTouched && profile?.display_name) setName(profile.display_name);
  }, [nameTouched, profile?.display_name]);

  async function handleSaveName() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSavingName(true);
    updateProfile.mutate(
      { display_name: trimmed },
      {
        onSettled: () => setSavingName(false),
        onError: () => Alert.alert(t('common:error'), t('account.saveNameError')),
      }
    );
  }

  async function handleChangeEmail() {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setEmailError(t('account.emailInvalid'));
      return;
    }
    setEmailError(null);
    setEmailStatus('saving');
    const { error } = await supabase.auth.updateUser({ email });
    if (error) {
      setEmailError(friendlyAuthError(error.message));
      setEmailStatus('idle');
    } else {
      setEmailStatus('sent');
    }
  }

  async function handleChangePassword() {
    if (pass1.length < 8) {
      setPassError(t('account.passwordTooShort'));
      return;
    }
    if (pass1 !== pass2) {
      setPassError(t('account.passwordMismatch'));
      return;
    }
    setPassError(null);
    setPassStatus('saving');
    const { error } = await supabase.auth.updateUser({ password: pass1 });
    if (error) {
      setPassError(friendlyAuthError(error.message));
      setPassStatus('idle');
    } else {
      setPass1('');
      setPass2('');
      setPassStatus('done');
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.text, letterSpacing: 1 }}>
          {t('account.title')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <SettingsGroup title={t('account.photoGroupTitle')}>
          <SettingsRow
            icon="camera-outline"
            label={uploading ? t('account.uploading') : t('account.changePhoto')}
            onPress={uploading ? undefined : pickAndUpload}
          />
        </SettingsGroup>
        {permissionDenied ? (
          <View className="px-4 -mt-4 mb-6 gap-1">
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.warning }}>
              {t('account.avatar.permissionDenied')}
            </Text>
            <TouchableOpacity onPress={() => Linking.openSettings()}>
              <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: colors.primary }}>
                {t('account.avatar.openSettings')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {avatarError ? (
          <Text className="px-4 -mt-4 mb-6" style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.destructive }}>
            {avatarError}
          </Text>
        ) : null}

        <View className="mb-6 gap-3">
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: 12, letterSpacing: 1, color: colors.textMuted }}>{t('account.nameLabel')}</Text>
          <Input placeholder={t('account.namePlaceholder')} value={name} onChangeText={(text) => {
            setNameTouched(true);
            setName(text);
          }} autoCapitalize="words" />
          <Button label={t('account.saveName')} size="sm" variant="secondary" loading={savingName} onPress={handleSaveName} />
        </View>

        <View className="mb-6 gap-3">
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: 12, letterSpacing: 1, color: colors.textMuted }}>{t('account.emailLabel')}</Text>
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: 14, color: colors.text }}>{user?.email}</Text>
          {emailStatus === 'sent' ? (
            <View className="bg-surface border border-border rounded-xl p-3">
              <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.success }}>
                {t('account.emailSentNotice')}
              </Text>
            </View>
          ) : (
            <>
              <Input
                placeholder={t('account.emailPlaceholder')}
                value={newEmail}
                onChangeText={setNewEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              {emailError ? (
                <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.destructive }}>{emailError}</Text>
              ) : null}
              <Button label={t('account.changeEmail')} size="sm" variant="secondary" loading={emailStatus === 'saving'} onPress={handleChangeEmail} />
            </>
          )}
        </View>

        <View className="mb-6 gap-3">
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: 12, letterSpacing: 1, color: colors.textMuted }}>{t('account.passwordLabel')}</Text>
          {passStatus === 'done' ? (
            <View className="bg-surface border border-border rounded-xl p-3">
              <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.success }}>{t('account.passwordUpdated')}</Text>
            </View>
          ) : (
            <>
              <Input placeholder={t('account.newPasswordPlaceholder')} value={pass1} onChangeText={setPass1} secureTextEntry autoComplete="new-password" />
              <Input placeholder={t('account.confirmPasswordPlaceholder')} value={pass2} onChangeText={setPass2} secureTextEntry autoComplete="new-password" />
              {passError ? (
                <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.destructive }}>{passError}</Text>
              ) : null}
              <Button label={t('account.changePassword')} size="sm" variant="secondary" loading={passStatus === 'saving'} onPress={handleChangePassword} />
            </>
          )}
        </View>

        <SettingsGroup title={t('account.dangerZone')}>
          <SettingsRow
            icon="trash-outline"
            label={t('account.deleteAccountRow')}
            danger
            onPress={() => router.push('/(app)/settings/delete-account' as never)}
          />
        </SettingsGroup>
      </ScrollView>
    </SafeAreaView>
  );
}
