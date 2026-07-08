import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import i18n, { setAppLanguage, type AppLanguage } from '@/lib/i18n';

// profiles.language manda cuando existe; si es NULL (alta nueva o usuario
// pre-i18n) se escribe UNA vez el idioma activo de la app.
export function useSyncLanguage() {
  const { user } = useAuthStore();
  const { data: profile } = useProfile();
  const { mutate: mutateProfile } = useUpdateProfile();
  const wroteInitial = useRef(false);

  useEffect(() => {
    if (!user || profile === undefined || profile === null) return;
    const lang = profile.language;
    if (lang === 'es' || lang === 'en') {
      if (lang !== i18n.language) setAppLanguage(lang as AppLanguage);
    } else if (!wroteInitial.current) {
      wroteInitial.current = true;
      mutateProfile({ language: i18n.language as AppLanguage });
    }
  }, [user, profile, mutateProfile]);
}
