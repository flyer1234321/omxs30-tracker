export type AppLanguage = 'sv' | 'en';

export function normalizeLanguage(value: unknown): AppLanguage {
  return value === 'en' ? 'en' : 'sv';
}

export function appLocale(language: AppLanguage): string {
  return language === 'en' ? 'en-GB' : 'sv-SE';
}
