import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { colors } from '@/constants/colors';

const CONFIRM_WORD = 'ELIMINAR';

export default function DeleteAccountScreen() {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enabled = confirmText.trim().toUpperCase() === CONFIRM_WORD && !deleting;

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const { error: fnError } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    if (fnError) {
      setError('No se pudo eliminar la cuenta. Intenta de nuevo o contacta soporte.');
      setDeleting(false);
      return;
    }
    // Cuenta borrada en el servidor: cerrar sesión local (el AuthGuard redirige a login)
    await supabase.auth.signOut();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.destructive, letterSpacing: 1 }}>
          Eliminar cuenta
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View className="bg-surface border rounded-2xl p-4 gap-3" style={{ borderColor: colors.destructive + '60' }}>
          <View className="flex-row items-center gap-2">
            <Ionicons name="warning" size={20} color={colors.destructive} />
            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, color: colors.text }}>
              Esto es irreversible
            </Text>
          </View>
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: 14, color: colors.textMuted, lineHeight: 20 }}>
            Se borra TODO de forma permanente: tu perfil, planes de entrenamiento y alimentación,
            historial de chat con Vulcano, registros corporales, racha y foto de perfil.
            {'\n\n'}Si tienes una suscripción activa, se cancela en este momento (sin reembolso del
            periodo en curso).
          </Text>
        </View>

        <Text style={{ fontFamily: 'Inter-Regular', fontSize: 14, color: colors.text }}>
          Escribe <Text style={{ fontFamily: 'Inter-Medium', color: colors.destructive }}>{CONFIRM_WORD}</Text> para confirmar:
        </Text>
        <Input placeholder={CONFIRM_WORD} value={confirmText} onChangeText={setConfirmText} autoCapitalize="characters" />

        {error ? (
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.destructive }}>{error}</Text>
        ) : null}

        <Button
          label={deleting ? 'Eliminando...' : 'Eliminar mi cuenta para siempre'}
          variant="destructive"
          disabled={!enabled}
          loading={deleting}
          onPress={handleDelete}
        />
        <Button label="Cancelar" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}
