export interface ChartDataPoint {
  date: string;
  close: number;
  volume?: number | null;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  sma50?: number | null;
  sma125?: number | null;
  sma200?: number | null;
}

export interface ChecklistItem {
  label: string;
  passed: boolean;
  detail: string;
}

export interface HealthCheck {
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  gradeScore: number;
  summary: string;
  riskLevel: 'Låg' | 'Medel' | 'Hög';
  momentum: 'Uppåt' | 'Nedåt' | 'Sidledes';
  checklist: ChecklistItem[];
}

export type SignalKind = 'goldenCross' | 'volumeSpike' | 'valueDiscount';
export type SignalTone = 'positive' | 'attention' | 'value';

export interface StockSignal {
  kind: SignalKind;
  label: string;
  detail: string;
  tone: SignalTone;
  observedAt: string;
}

export interface ValuationSnapshot {
  trailingPE5yMedian: number | null;
  trailingPESectorMedian: number | null;
}

export type TableColumnId =
  | 'ticker'
  | 'grade'
  | 'price'
  | 'change'
  | 'rsi'
  | 'volume'
  | 'pe'
  | 'sma'
  | 'volatility'
  | 'beta'
  | 'drawdown'
  | 'riskReward'
  | 'trend';

export interface Workspace {
  id: string;
  name: string;
  columns: TableColumnId[];
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockData {
  ticker: string;
  companyName: string;
  currentPrice: number;
  sma50: number | null;
  sma125: number | null;
  sma200: number | null;
  rsi: number | null;
  diffPercent125: number | null;
  chartHistory: ChartDataPoint[];
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  trailingPE: number | null;
  dividendYield: number | null;
  marketCap: number | null;
  regularMarketChangePercent: number | null;
  regularMarketOpen: number | null;
  regularMarketDayHigh: number | null;
  regularMarketDayLow: number | null;
  regularMarketPreviousClose: number | null;
  epsTrailingTwelveMonths: number | null;
  latestVolume: number | null;
  avgVolume20: number | null;
  volatility: number | null;
  beta: number | null;
  maxDrawdown: number | null;
  riskRewardScore: number | null;
  healthCheck: HealthCheck | null;
  valuation?: ValuationSnapshot;
  signals?: StockSignal[];
  macdData?: { trend: 'up' | 'down' | 'neutral' } | null;
}
