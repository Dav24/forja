import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Buffer } from 'buffer';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';

export function useAvatarUpload() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  async function pickAndUpload() {
    if (!user) return;
    setError(null);
    setPermissionDenied(false);

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setPermissionDenied(true);
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (picked.canceled) return;

    setUploading(true);
    try {
      const ctx = ImageManipulator.manipulate(picked.assets[0].uri);
      ctx.resize({ width: 512, height: 512 });
      const rendered = await ctx.renderAsync();
      const saved = await rendered.saveAsync({
        compress: 0.7,
        format: SaveFormat.JPEG,
        base64: true,
      });

      const bytes = Buffer.from(saved.base64!, 'base64');
      const path = `${user.id}.jpg`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = `${pub.publicUrl}?v=${Date.now()}`;
      const { error: profErr } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', user.id);
      if (profErr) throw profErr;

      queryClient.invalidateQueries({ queryKey: ['profile'] });
    } catch {
      setError('No se pudo subir la foto. Intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  }

  return { pickAndUpload, uploading, error, permissionDenied };
}
