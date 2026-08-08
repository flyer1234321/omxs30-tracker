import YahooFinance from 'yahoo-finance2';
import { mapWithConcurrency } from '@/lib/concurrency';
import {
  bucketForSurprise,
  findAnnouncementIndex,
  measureEvent,
  summarise,
  type EventPricePoint,
  type SurpriseBucket,
  type Summary,
} from '@/lib/event-study';

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
  validation: { logErrors: false },
});

/** Horisonter i handelsdagar efter rapporten. */
export const HORIZONS = [1, 5, 20, 60];

/**
 * Hur tydlig volymtoppen måste vara för att dagen ska godtas som rapportdag.
 * Rapportdagar omsätter typiskt två till fyra gånger snittvolymen. Kravet är
 * satt lågt nog att inte tappa lugna bolag, men högt nog att en slumpmässig
 * torsdag inte ska passera.
 */
const MINIMUM_VOLUME_RATIO = 1.8;

/**
 * Överraskningen räknas som procent av estimatet. Ligger estimatet nära noll
 * blir kvoten godtyckligt stor: en vinst på 2 öre mot väntade 1 öre blir
 * "100 % överraskning" utan att betyda något. Extremvärden utesluts därför,
 * vilket är gängse praxis i den här typen av studier.
 */
const MAX_MEANINGFUL_SURPRISE_PERCENT = 200;

interface EarningsHistoryEntry {
  epsActual: number | null;
  epsEstimate: number | null;
  surprisePercent: number | null;
  quarter: Date | null;
  period: string;
}

export interface EarningsEvent {
  ticker: string;
  quarter: string;
  period: string;
  /** Saknas när Yahoo har rapportdatum men inget analytikerkonsensus. */
  surprisePercent: number | null;
  bucket: SurpriseBucket | null;
  announcementDate: string;
  /** Hur tydlig volymtoppen var. Låg siffra = osäkert datum. */
  volumeRatio: number;
  reactionPercent: number | null;
  abnormalDriftPercent: Record<number, number | null>;
}

interface ChartResponse {
  quotes?: { date: Date | string; close: number | null; volume?: number | null }[];
}

interface QuarterlyStatement {
  endDate?: Date | string | null;
}

interface EarningsSummary {
  earningsHistory?: { history?: EarningsHistoryEntry[] };
  incomeStatementHistoryQuarterly?: { incomeStatementHistory?: QuarterlyStatement[] };
}

interface QuarterCandidate {
  quarter: Date;
  period: string;
  surprisePercent: number | null;
}

function quarterLabel(date: Date) {
  return `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${date.getUTCFullYear()}`;
}

/** Kombinerar konsensushistorik med rapportperioder som saknar estimat. */
export function quarterCandidates(summary: EarningsSummary): QuarterCandidate[] {
  const byDate = new Map<string, QuarterCandidate>();

  for (const entry of summary.earningsHistory?.history || []) {
    if (!entry.quarter) continue;
    const quarter = new Date(entry.quarter);
    if (!Number.isFinite(quarter.getTime())) continue;
    const surprise = entry.surprisePercent == null ? null : entry.surprisePercent * 100;
    byDate.set(quarter.toISOString().slice(0, 10), {
      quarter,
      period: entry.period || quarterLabel(quarter),
      surprisePercent: surprise != null && Math.abs(surprise) <= MAX_MEANINGFUL_SURPRISE_PERCENT ? surprise : null,
    });
  }

  for (const statement of summary.incomeStatementHistoryQuarterly?.incomeStatementHistory || []) {
    if (!statement.endDate) continue;
    const quarter = new Date(statement.endDate);
    if (!Number.isFinite(quarter.getTime())) continue;
    const key = quarter.toISOString().slice(0, 10);
    if (!byDate.has(key)) {
      byDate.set(key, { quarter, period: quarterLabel(quarter), surprisePercent: null });
    }
  }

  return [...byDate.values()].sort((a, b) => b.quarter.getTime() - a.quarter.getTime()).slice(0, 8);
}

function toPricePoints(chart: ChartResponse): EventPricePoint[] {
  return (chart.quotes || [])
    .filter((quote): quote is { date: Date | string; close: number; volume?: number | null } => quote.close != null)
    .map((quote) => ({
      date: new Date(quote.date).toISOString(),
      close: quote.close,
      volume: quote.volume ?? null,
    }));
}

async function loadBenchmark(symbol: string, period1: Date) {
  try {
    const chart = await yahooFinance.chart(symbol, { period1, interval: '1d' }, { validateResult: false }) as ChartResponse;
    return toPricePoints(chart);
  } catch (error) {
    console.error(`Earnings study could not load benchmark ${symbol}:`, error);
    return [];
  }
}

/**
 * Yahoo lämnar bara ut de senaste kvartalen per bolag, så ett enskilt bolag ger
 * en handfull händelser. Slutsatser dras därför på hela urvalet, inte per
 * aktie: fyra observationer säger ingenting oavsett hur de ser ut.
 */
async function loadTickerEvents(ticker: string, benchmark: EventPricePoint[], period1: Date): Promise<EarningsEvent[]> {
  try {
    const [summary, chart] = await Promise.all([
      yahooFinance.quoteSummary(
        ticker,
        { modules: ['earningsHistory', 'incomeStatementHistoryQuarterly'] },
        { validateResult: false },
      ) as Promise<EarningsSummary>,
      yahooFinance.chart(ticker, { period1, interval: '1d' }, { validateResult: false }) as Promise<ChartResponse>,
    ]);

    const history = toPricePoints(chart);
    const quarters = quarterCandidates(summary);
    if (!history.length || !quarters.length) return [];

    const events: EarningsEvent[] = [];
    for (const quarter of quarters) {
      const located = findAnnouncementIndex(history, quarter.quarter);
      // Utan konsensus används rapportperioden som reservkälla. Då accepteras
      // en något svagare volymtopp, men estimatöverraskningen lämnas tom.
      const minimumVolumeRatio = quarter.surprisePercent == null ? 1.2 : MINIMUM_VOLUME_RATIO;
      if (!located || located.volumeRatio < minimumVolumeRatio) continue;

      const outcome = measureEvent(history, benchmark, located.index, HORIZONS);

      events.push({
        ticker,
        quarter: new Date(quarter.quarter).toISOString().slice(0, 10),
        period: quarter.period,
        surprisePercent: quarter.surprisePercent,
        bucket: quarter.surprisePercent == null ? null : bucketForSurprise(quarter.surprisePercent),
        announcementDate: history[located.index].date.slice(0, 10),
        volumeRatio: located.volumeRatio,
        reactionPercent: outcome.reactionPercent,
        abnormalDriftPercent: outcome.abnormalDriftPercent,
      });
    }
    return events;
  } catch (error) {
    console.error(`Earnings study failed for ${ticker}:`, error);
    return [];
  }
}

export interface BucketResult {
  bucket: SurpriseBucket;
  reaction: Summary | null;
  drift: Record<number, Summary | null>;
}

export interface EarningsStudy {
  events: EarningsEvent[];
  buckets: BucketResult[];
  tickersRequested: number;
  tickersWithData: number;
  generatedAt: string;
}

export function aggregateEvents(events: EarningsEvent[]): BucketResult[] {
  const buckets: SurpriseBucket[] = ['stor_positiv', 'positiv', 'neutral', 'negativ', 'stor_negativ'];

  return buckets.map((bucket) => {
    const matching = events.filter((event) => event.bucket === bucket);
    const drift: Record<number, Summary | null> = {};
    for (const horizon of HORIZONS) {
      drift[horizon] = summarise(matching.map((event) => event.abnormalDriftPercent[horizon]));
    }
    return {
      bucket,
      reaction: summarise(matching.map((event) => event.reactionPercent)),
      drift,
    };
  });
}

export async function runEarningsStudy(tickers: string[], benchmarkSymbol: string, years = 3): Promise<EarningsStudy> {
  const period1 = new Date();
  period1.setFullYear(period1.getFullYear() - years);

  const benchmark = await loadBenchmark(benchmarkSymbol, period1);
  const perTicker = await mapWithConcurrency(tickers, 4, (ticker) => loadTickerEvents(ticker, benchmark, period1));
  const events = perTicker.flat();

  return {
    events,
    buckets: aggregateEvents(events),
    tickersRequested: tickers.length,
    tickersWithData: perTicker.filter((list) => list.length > 0).length,
    generatedAt: new Date().toISOString(),
  };
}
