import type { QualityScore } from '@/lib/quality-score';

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
  /**
   * De tre tekniska bonuspoängen. De räknades tidigare in i poängen utan att
   * visas någonstans, vilket gjorde att 5 av 9 inte gick att härleda ur de sex
   * kryssen i listan.
   */
  bonuses: ChecklistItem[];
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
   * Prisbaserad värderingsproxy för de senaste tolv månaderna, beräknad som
   * medianstängningskurs delat med nuvarande vinst per aktie. Vinsten hålls
   * alltså konstant - måttet fångar var kursen legat i förhållande till dagens
   * intjäning, inte hur vinsten utvecklats. Det räknas fram ur kurshistoriken
   * som redan hämtas och kostar därför inga extra anrop.
   */
  trailingPEProxyMedian: number | null;
  trailingPESectorMedian: number | null;
  /** Antal jämförbara bolag bakom sektorns median. */
  sectorSampleSize: number;
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
  | 'relativeStrength'
  | 'quality'
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
  /** Sektor enligt senaste tillgängliga bolagsprofil. */
  sector: string | null;
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
  /**
   * Kvalitet ur balans- och resultaträkningen, skild från rekylläget.
   * Rekylläget mäter om kursen fallit; det här måttet om fallet är befogat.
   */
  quality: QualityScore | null;
}
