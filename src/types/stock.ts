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

export type SignalKind = 'goldenCross' | 'volumeSpike' | 'valueDiscount' | 'earningsSoon';
export type SignalTone = 'positive' | 'attention' | 'value';

export interface StockSignal {
  kind: SignalKind;
  label: string;
  detail: string;
  tone: SignalTone;
  observedAt: string;
}

export interface ValuationSnapshot {
  /**
   * Medianvärdering under de senaste tolv månaderna, beräknad som
   * medianstängningskurs delat med nuvarande vinst per aktie. Vinsten hålls
   * alltså konstant - måttet fångar var kursen legat i förhållande till dagens
   * intjäning, inte hur vinsten utvecklats. Det räknas fram ur kurshistoriken
   * som redan hämtas och kostar därför inga extra anrop.
   */
  trailingPEMedian: number | null;
  trailingPESectorMedian: number | null;
}

/**
 * Konkreta nivåer att agera på, härledda ur ATR och närliggande stöd/motstånd.
 */
export interface TradePlan {
  atr: number;
  atrPercent: number;
  stopLoss: number;
  stopBasis: string;
  target: number;
  targetBasis: string;
  riskPerShare: number;
  riskPercent: number;
  rewardPercent: number;
  rMultiple: number;
}

/** De marknadsurval som screenern kan visa. */
export type MarketId = 'omxs30' | 'swe_broad' | 'dji' | 'tech' | 'swe_fastigheter' | 'watchlist';

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
  | 'relativeStrength'
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
  /** Handelsvaluta enligt Yahoo, t.ex. SEK eller USD. */
  currency: string | null;
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
  /** Genomsnittlig daglig rörelse (ATR 14) i handelsvalutan. */
  atr: number | null;
  tradePlan: TradePlan | null;
  /** Avkastning minus index de senaste 63 handelsdagarna, i procentenheter. */
  relativeStrength63: number | null;
  /** Nästa rapportdatum enligt Yahoo, i millisekunder. */
  earningsTimestamp: number | null;
  priceToBook: number | null;
  bookValue: number | null;
}
