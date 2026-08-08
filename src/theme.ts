import { Platform } from 'react-native';

function themedColor(variable: string, fallback: string) {
  return Platform.OS === 'web' ? `var(--${variable}, ${fallback})` : fallback;
}

export const colors = {
  // Backgrounds
  bg: themedColor('color-bg', '#08080f'),
  surface: themedColor('color-surface', '#111118'),
  surfaceAlt: themedColor('color-surface-alt', '#16161f'),
  surfaceHover: themedColor('color-surface-hover', '#1c1c28'),
  border: themedColor('color-border', '#1e1e2e'),
  borderSubtle: themedColor('color-border-subtle', '#151520'),
  borderStrong: themedColor('color-border-strong', '#2a2a35'),
  
  // Text
  textStrong: themedColor('color-text-strong', '#ffffff'),
  textPrimary: themedColor('color-text-primary', '#e2e2ea'),
  textBody: themedColor('color-text-body', '#d1d1d6'),
  textSecondary: themedColor('color-text-secondary', '#a3a3b7'),
  textMuted: themedColor('color-text-muted', '#7f7f95'),
  textInverse: themedColor('color-text-inverse', '#08080f'),
  
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
  accentBg: themedColor('color-accent-bg', 'rgba(59,130,246,0.10)'),
  accentBorder: themedColor('color-accent-border', 'rgba(59,130,246,0.25)'),
  
  warning: '#f59e0b',
  warningBright: '#fbbf24',
  warningBg: 'rgba(245,158,11,0.08)',

  // Diagramserier: en fast farg per glidande medelvarde
  sma50: '#8b5cf6',
  sma125: '#f59e0b',
  sma200: '#fb2c55',
  grid: themedColor('color-grid', '#20202a'),
  
  // Grades
  gradeA: { bg: themedColor('color-grade-a-bg', '#0a2e1a'), text: '#22c55e', border: '#16a34a' },
  gradeB: { bg: themedColor('color-grade-b-bg', '#1a2e0a'), text: themedColor('color-grade-b-text', '#84cc16'), border: '#65a30d' },
  gradeC: { bg: themedColor('color-grade-c-bg', '#2e2a0a'), text: themedColor('color-grade-c-text', '#eab308'), border: '#ca8a04' },
  gradeD: { bg: themedColor('color-grade-d-bg', '#2e1a0a'), text: '#f97316', border: '#ea580c' },
  gradeF: { bg: themedColor('color-grade-f-bg', '#2e0a0a'), text: '#ef4444', border: '#dc2626' },
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
