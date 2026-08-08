import type { TableColumnId, Workspace } from '@/types/stock';
import type { AppLanguage } from '@/lib/language';

export const WORKSPACE_STORAGE_KEY = '@table_workspaces_v1';
export const ACTIVE_WORKSPACE_STORAGE_KEY = '@active_table_workspace_v1';

/** Etiketterna här, förklaringarna i src/lib/glossary.ts. */
export const TABLE_COLUMNS: { id: TableColumnId; label: string; labelEn: string }[] = [
  { id: 'ticker', label: 'Ticker', labelEn: 'Ticker' },
  { id: 'grade', label: 'Rekyl', labelEn: 'Pullback' },
  { id: 'price', label: 'Pris', labelEn: 'Price' },
  { id: 'change', label: '% idag', labelEn: '% today' },
  { id: 'rsi', label: 'RSI', labelEn: 'RSI' },
  { id: 'volume', label: 'Volym', labelEn: 'Volume' },
  { id: 'pe', label: 'P/E', labelEn: 'P/E' },
  { id: 'sma', label: 'SMA', labelEn: 'SMA' },
  { id: 'volatility', label: 'Volatilitet', labelEn: 'Volatility' },
  { id: 'beta', label: 'Beta', labelEn: 'Beta' },
  { id: 'drawdown', label: 'Max DD', labelEn: 'Max DD' },
  { id: 'relativeStrength', label: 'Mot index', labelEn: 'vs index' },
  { id: 'quality', label: 'Kvalitet', labelEn: 'Quality' },
  { id: 'trend', label: '7d trend', labelEn: '7d trend' },
];

const now = new Date().toISOString();

export const DEFAULT_WORKSPACES: Workspace[] = [
  { id: 'overview', name: 'Översikt', columns: ['ticker', 'grade', 'price', 'change', 'rsi', 'volume', 'pe', 'sma', 'trend'], isDefault: true, createdAt: now, updatedAt: now },
  { id: 'momentum', name: 'Momentum', columns: ['ticker', 'price', 'change', 'rsi', 'volume', 'relativeStrength', 'sma', 'volatility', 'trend'], isDefault: true, createdAt: now, updatedAt: now },
  { id: 'risk', name: 'Risk', columns: ['ticker', 'price', 'change', 'volatility', 'beta', 'drawdown', 'quality', 'sma'], isDefault: true, createdAt: now, updatedAt: now },
  { id: 'value', name: 'Värde', columns: ['ticker', 'grade', 'quality', 'price', 'pe', 'volume', 'sma'], isDefault: true, createdAt: now, updatedAt: now },
];

const DEFAULT_WORKSPACE_NAMES: Record<string, { sv: string; en: string }> = {
  overview: { sv: 'Översikt', en: 'Overview' },
  momentum: { sv: 'Momentum', en: 'Momentum' },
  risk: { sv: 'Risk', en: 'Risk' },
  value: { sv: 'Värde', en: 'Value' },
};

export function workspaceDisplayName(workspace: Workspace, language: AppLanguage): string {
  const translated = DEFAULT_WORKSPACE_NAMES[workspace.id];
  return translated ? translated[language] : workspace.name;
}

export function tableColumnLabel(column: { label: string; labelEn: string }, language: AppLanguage): string {
  return language === 'en' ? column.labelEn : column.label;
}

const validColumnIds = new Set(TABLE_COLUMNS.map((column) => column.id));

export function normalizeWorkspace(workspace: Workspace): Workspace {
  const columns = workspace.columns.filter((column): column is TableColumnId => validColumnIds.has(column));
  return {
    ...workspace,
    columns: ['ticker', ...columns.filter((column) => column !== 'ticker')],
  };
}
