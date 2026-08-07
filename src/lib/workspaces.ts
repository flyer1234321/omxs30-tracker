import type { TableColumnId, Workspace } from '@/types/stock';

export const WORKSPACE_STORAGE_KEY = '@table_workspaces_v1';
export const ACTIVE_WORKSPACE_STORAGE_KEY = '@active_table_workspace_v1';

export const TABLE_COLUMNS: { id: TableColumnId; label: string; description: string }[] = [
  { id: 'ticker', label: 'Ticker', description: 'Aktiesymbolen. Klicka på en aktierad för att öppna dess fullständiga analys.' },
  { id: 'grade', label: 'Betyg', description: 'Appens samlade hälsobetyg från A till F. Det är beslutsstöd, inte ett köpråd.' },
  { id: 'price', label: 'Pris', description: 'Senast tillgängliga aktiekurs i den lokala handelsvalutan.' },
  { id: 'change', label: '% idag', description: 'Procentuell kursförändring under den aktuella handelsdagen.' },
  { id: 'rsi', label: 'RSI', description: 'Momentumindikator. Över 70 kan indikera överköpt och under 30 översålt, utan garanti för vändning.' },
  { id: 'volume', label: 'Volym', description: 'Senaste handelsvolym relativt 20-dagarssnittet. 2,0x betyder dubbelt snittvolym.' },
  { id: 'pe', label: 'P/E', description: 'Pris dividerat med vinst per aktie. Ett lägre tal är inte automatiskt bättre.' },
  { id: 'sma', label: 'SMA', description: 'Pilen visar om kursen ligger över eller under SMA 125, ungefär ett halvårssnitt.' },
  { id: 'volatility', label: 'Volatilitet', description: 'Årsomräknad volatilitet från de senaste 20 handelsdagarna. Högre värde innebär större historiska rörelser.' },
  { id: 'beta', label: 'Beta', description: 'Hur mycket aktien historiskt rört sig relativt sitt jämförelseindex. 1,0 motsvarar ungefär indexrörelsen.' },
  { id: 'drawdown', label: 'Max DD', description: 'Största historiska nedgång från en tidigare topp inom tillgängligt kursunderlag.' },
  { id: 'riskReward', label: 'Risk/Reward', description: 'Intern poäng från 0 till 100 som väger trend, volatilitet och hälsobetyg. Den är inte en prognos.' },
  { id: 'trend', label: '7d trend', description: 'Mini-graf över de senaste sju dagarnas tillgängliga kursrörelser.' },
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
