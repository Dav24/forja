import i18n from '@/lib/i18n';

export function i18nLocale(): string {
  return i18n.language === 'es' ? 'es-MX' : 'en-US';
}

export function formatDate(
  date: string | number | Date,
  options: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat(i18nLocale(), options).format(new Date(date));
}
