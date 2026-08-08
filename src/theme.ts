import { Platform } from 'react-native';

export const colors = {
  // Backgrounds
  bg: '#08080f',
  surface: '#111118',
  surfaceAlt: '#16161f',
  surfaceHover: '#1c1c28',
  border: '#1e1e2e',
  borderSubtle: '#151520',
  borderStrong: '#2a2a35',
  
  // Text
  textStrong: '#ffffff',
  textPrimary: '#e2e2ea',
  textBody: '#d1d1d6',
  textSecondary: '#a3a3b7',
  textMuted: '#7f7f95',
  textInverse: '#08080f',
  
  // Semantic colors - muted for pro trader look
  positive: '#22c55e',
  positiveDim: '#16a34a',
  positiveBg: 'rgba(34,197,94,0.08)',
  positiveBorder: 'rgba(34,197,94,0.20)',
  
  negative: '#ef4444',
  negativeDim: '#dc2626',
  negativeBg: 'rgba(239,68,68,0.08)',
  negativeBorder: 'rgba(239,68,68,0.20)',
  
  // Accent
  accent: '#3b82f6',
  accentBg: 'rgba(59,130,246,0.10)',
  accentBorder: 'rgba(59,130,246,0.25)',
  
  warning: '#f59e0b',
  warningBright: '#fbbf24',
  warningBg: 'rgba(245,158,11,0.08)',

  // Diagramserier: en fast farg per glidande medelvarde
  sma50: '#8b5cf6',
  sma125: '#f59e0b',
  sma200: '#fb2c55',
  grid: '#20202a',
  
  // Grades
  gradeA: { bg: '#0a2e1a', text: '#22c55e', border: '#16a34a' },
  gradeB: { bg: '#1a2e0a', text: '#84cc16', border: '#65a30d' },
  gradeC: { bg: '#2e2a0a', text: '#eab308', border: '#ca8a04' },
  gradeD: { bg: '#2e1a0a', text: '#f97316', border: '#ea580c' },
  gradeF: { bg: '#2e0a0a', text: '#ef4444', border: '#dc2626' },
};

export const gradeColorMap: Record<string, { bg: string; text: string; border: string }> = {
  A: colors.gradeA,
  B: colors.gradeB,
  C: colors.gradeC,
  D: colors.gradeD,
  F: colors.gradeF,
};

export const fonts = {
  mono: Platform.OS === 'web' ? "'JetBrains Mono', 'SF Mono', 'Cascadia Code', 'Fira Code', monospace" : 'monospace',
  sans: Platform.OS === 'web' ? "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" : undefined,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
};

/**
 * Signalmärkningarnas färger. Ligger här så att tabellen, detaljvyn och
 * utskriften använder samma skala.
 */
export const signalTones = {
  positive: { backgroundColor: 'rgba(34,197,94,0.14)', color: '#86efac' },
  attention: { backgroundColor: 'rgba(245,158,11,0.14)', color: '#fcd34d' },
  value: { backgroundColor: 'rgba(59,130,246,0.14)', color: '#93c5fd' },
};

/** Bredaste innehållsbredd innan layouten börjar se tom ut på en stor skärm. */
export const maxContentWidth = 1440;
