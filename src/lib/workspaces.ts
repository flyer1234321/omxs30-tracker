import type { TableColumnId, Workspace } from '@/types/stock';

export const WORKSPACE_STORAGE_KEY = '@table_workspaces_v1';
export const ACTIVE_WORKSPACE_STORAGE_KEY = '@active_table_workspace_v1';

export const TABLE_COLUMNS: { id: TableColumnId; label: string }[] = [
  { id: 'ticker', label: 'Ticker' },
  { id: 'grade', label: 'Betyg' },
  { id: 'price', label: 'Pris' },
  { id: 'change', label: '% idag' },
  { id: 'rsi', label: 'RSI' },
  { id: 'volume', label: 'Volym' },
  { id: 'pe', label: 'P/E' },
  { id: 'sma', label: 'SMA' },
  { id: 'volatility', label: 'Volatilitet' },
  { id: 'beta', label: 'Beta' },
  { id: 'drawdown', label: 'Max DD' },
  { id: 'riskReward', label: 'Risk/Reward' },
  { id: 'trend', label: '7d trend' },
];

const now = new Date().toISOString();

export const DEFAULT_WORKSPACES: Workspace[] = [
  { id: 'overview', name: 'Översikt', columns: ['ticker', 'grade', 'price', 'change', 'rsi', 'volume', 'pe', 'sma', 'trend'], isDefault: true, createdAt: now, updatedAt: now },
  { id: 'momentum', name: 'Momentum', columns: ['ticker', 'price', 'change', 'rsi', 'volume', 'sma', 'volatility', 'beta', 'trend'], isDefault: true, createdAt: now, updatedAt: now },
  { id: 'risk', name: 'Risk', columns: ['ticker', 'price', 'change', 'volatility', 'beta', 'drawdown', 'riskReward', 'sma'], isDefault: true, createdAt: now, updatedAt: now },
  { id: 'value', name: 'Värde', columns: ['ticker', 'grade', 'price', 'pe', 'volume', 'riskReward', 'sma'], isDefault: true, createdAt: now, updatedAt: now },
];

const validColumnIds = new Set(TABLE_COLUMNS.map((column) => column.id));

export function normalizeWorkspace(workspace: Workspace): Workspace {
  const columns = workspace.columns.filter((column): column is TableColumnId => validColumnIds.has(column));
  return {
    ...workspace,
    columns: ['ticker', ...columns.filter((column) => column !== 'ticker')],
  };
}
