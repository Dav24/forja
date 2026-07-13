import { useState } from 'react';
import { Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/lib/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, secureTextEntry, className = '', ...props }: InputProps) {
  const { colors } = useTheme();
  const { t } = useTranslation('common');
  const [visible, setVisible] = useState(false);

  return (
    <View className={className}>
      {label && (
        <Text className="text-text text-sm font-medium mb-2">{label}</Text>
      )}
      <View className="relative">
        <TextInput
          className={`bg-surface border ${error ? 'border-destructive' : 'border-border'} rounded-xl px-4 h-14 text-text text-base pr-12`}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secureTextEntry && !visible}
          {...props}
        />
        {secureTextEntry && (
          <TouchableOpacity
            className="absolute right-4 top-0 bottom-0 justify-center"
            onPress={() => setVisible((v) => !v)}
          >
            <Text className="text-text-muted text-sm">{visible ? t('hide') : t('show')}</Text>
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text className="text-destructive text-xs mt-1">{error}</Text>
      )}
    </View>
  );
}
