import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from '@/locales/es';
import en from '@/locales/en';

export type AppLanguage = 'es' | 'en';
export const LANGUAGE_STORAGE_KEY = 'forja.language';

export function detectDeviceLanguage(): AppLanguage {
  const code = Localization.getLocales()[0]?.languageCode ?? 'es';
  return code.startsWith('es') ? 'es' : 'en';
}

i18n.use(initReactI18next).init({
  resources: { es, en },
  lng: detectDeviceLanguage(),
  fallbackLng: 'es',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

// Rehidratar la elección persistida; casi siempre coincide con la detección,
// por eso no bloquea el primer render.
AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
  .then((stored) => {
    if ((stored === 'es' || stored === 'en') && stored !== i18n.language) {
      i18n.changeLanguage(stored);
    }
  })
  .catch(() => {});

export async function setAppLanguage(lang: AppLanguage): Promise<void> {
  await i18n.changeLanguage(lang);
  AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang).catch(() => {});
}

export default i18n;
