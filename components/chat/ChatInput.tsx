import { useState } from 'react';
import { View, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [text, setText] = useState('');

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}
    >
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Escríbele a Vulcano..."
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={500}
        style={{
          flex: 1,
          minHeight: 44,
          maxHeight: 112,
          backgroundColor: colors.surfaceElevated,
          color: colors.text,
          borderRadius: 16,
          paddingHorizontal: 16,
          paddingVertical: 10,
          fontFamily: 'Inter-Regular',
          fontSize: 15,
          lineHeight: 22,
        }}
        editable={!disabled}
      />
      <TouchableOpacity
        onPress={handleSend}
        disabled={!canSend}
        activeOpacity={0.75}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: canSend ? colors.primary : colors.surfaceElevated,
        }}
      >
        <Ionicons
          name="send"
          size={18}
          color={canSend ? colors.background : colors.textMuted}
        />
      </TouchableOpacity>
    </View>
  );
}
