import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '@/constants/colors';

export default function MealPlansScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ color: colors.text, fontFamily: 'SpaceGrotesk-Bold', fontSize: 18 }}>
          Planes Alimenticios
        </Text>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accent + '20', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Ionicons name="lock-closed" size={28} color={colors.accent} />
        </View>
        <Text style={{ color: colors.text, fontFamily: 'SpaceGrotesk-Bold', fontSize: 20, textAlign: 'center', marginBottom: 8 }}>
          Función Premium
        </Text>
        <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 15, textAlign: 'center', lineHeight: 22 }}>
          Los planes alimenticios detallados estarán disponibles próximamente con tu suscripción premium.
        </Text>
      </View>
    </SafeAreaView>
  );
}
