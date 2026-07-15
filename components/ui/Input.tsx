import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: IoniconsName;
}

export function Input({ label, error, secureTextEntry, leftIcon, className = '', ...props }: InputProps) {
  const { colors } = useTheme();
  const { t } = useTranslation('common');
  const [visible, setVisible] = useState(false);

  return (
    <View className={className}>
      {label && (
        <Text className="text-text text-sm font-medium mb-2">{label}</Text>
      )}
      <View className="relative">
        {leftIcon && (
          <View className="absolute left-4 top-0 bottom-0 justify-center z-10">
            <Ionicons name={leftIcon} size={18} color={colors.textMuted} />
          </View>
        )}
        <TextInput
          className={`bg-surface border ${error ? 'border-destructive' : 'border-border'} rounded-xl h-14 text-text text-base ${leftIcon ? 'pl-11' : 'px-4'} pr-12`}
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
