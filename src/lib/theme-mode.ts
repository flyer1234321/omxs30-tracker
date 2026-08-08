export type AppThemeMode = 'dark' | 'light';

export function normalizeThemeMode(value: unknown): AppThemeMode {
  return value === 'light' ? 'light' : 'dark';
}
