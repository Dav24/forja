import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '@/constants/colors';

export default function LanguageScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.text, letterSpacing: 1 }}>
          Idioma
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        <View className="rounded-2xl border border-primary bg-primary-dim px-4 py-3.5 flex-row items-center gap-3">
          <Text className="text-xl">🇲🇽</Text>
          <Text className="flex-1" style={{ fontFamily: 'Inter-Medium', fontSize: 15, color: colors.primary }}>Español</Text>
          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
        </View>
        <View className="rounded-2xl border border-border bg-surface px-4 py-3.5 flex-row items-center gap-3 opacity-50">
          <Text className="text-xl">🇺🇸</Text>
          <Text className="flex-1" style={{ fontFamily: 'Inter-Medium', fontSize: 15, color: colors.text }}>English</Text>
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textMuted }}>Próximamente</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
