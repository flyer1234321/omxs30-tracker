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
  surprisePercent: number;
  bucket: SurpriseBucket;
  announcementDate: string;
  /** Hur tydlig volymtoppen var. Låg siffra = osäkert datum. */
  volumeRatio: number;
  reactionPercent: number | null;
  abnormalDriftPercent: Record<number, number | null>;
}

interface ChartResponse {
  quotes?: { date: Date | string; close: number | null; volume?: number | null }[];
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
      yahooFinance.quoteSummary(ticker, { modules: ['earningsHistory'] }, { validateResult: false }) as Promise<{ earningsHistory?: { history?: EarningsHistoryEntry[] } }>,
      yahooFinance.chart(ticker, { period1, interval: '1d' }, { validateResult: false }) as Promise<ChartResponse>,
    ]);

    const history = toPricePoints(chart);
    const quarters = summary.earningsHistory?.history || [];
    if (!history.length || !quarters.length) return [];

    const events: EarningsEvent[] = [];
    for (const quarter of quarters) {
      if (quarter.surprisePercent == null || quarter.quarter == null) continue;

      // Yahoo lämnar överraskningen som andel (0,0286 för 2,86 %).
      const surprisePercent = quarter.surprisePercent * 100;
      if (Math.abs(surprisePercent) > MAX_MEANINGFUL_SURPRISE_PERCENT) continue;

      const located = findAnnouncementIndex(history, quarter.quarter);
      if (!located || located.volumeRatio < MINIMUM_VOLUME_RATIO) continue;

      const outcome = measureEvent(history, benchmark, located.index, HORIZONS);

      events.push({
        ticker,
        quarter: new Date(quarter.quarter).toISOString().slice(0, 10),
        period: quarter.period,
        surprisePercent,
        bucket: bucketForSurprise(surprisePercent),
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
