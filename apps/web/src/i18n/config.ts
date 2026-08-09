export const locales = ['en', 'zh'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export function getMessages(locale: Locale) {
  switch (locale) {
    case 'zh':
      return import('./zh.json');
    case 'en':
    default:
      return import('./en.json');
  }
}

export function getLocaleFromHeader(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale;
  if (acceptLanguage.includes('zh')) return 'zh';
  return 'en';
}
