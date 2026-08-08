import {
  calculateLowerBandSeries,
  calculateMacdTrendSeries,
  calculateRsiSeries,
  calculateSmaSeries,
  rollingExtremes,
} from '@/lib/indicators';
import { summarise, type EventPricePoint, type Summary } from '@/lib/event-study';

/**
 * Mäter om rekylläget faktiskt förutsagt något.
 *
 * Fyra metodval avgör om siffrorna betyder något alls:
 *
 * 1. **Punkt i tid.** Poängen räknas med enbart den information som fanns den
 *    dagen. Även 52-veckorsnivåerna räknas rullande ur historiken, inte från
 *    dagens quote - annars hade modellen vetat var botten skulle komma.
 *
 * 2. **Bara de tekniska kriterierna.** Sju av nio poäng går att räkna
 *    punkt i tid. De två som inte gör det, positiv vinst och utdelning, kommer
 *    från dagens quote och hade smugit in framtida information. De utelämnas
 *    hellre än att gissas.
 *
 * 3. **Mot index.** Överavkastning, inte avkastning. Annars mäter man mest om
 *    perioden råkade vara en uppgångsfas.
 *
 * 4. **Månadsvis sampling.** Två observationer en dag isär delar 59 av 60
 *    dagars framtid. Räknar man varje dag som ett oberoende fall blir varje
 *    resultat statistiskt signifikant, oavsett om det är sant. Därför används
 *    var 21:a handelsdag.
 */

/** Maxpoäng i den delmängd som går att räkna punkt i tid. */
export const MAX_TECHNICAL_SCORE = 7;

const SAMPLE_EVERY_TRADING_DAYS = 21;

export interface RekylObservation {
  index: number;
  date: string;
  score: number;
  forwardAbnormal: Record<number, number | null>;
}

export function computeTechnicalScoreSeries(history: EventPricePoint[]): (number | null)[] {
  const sma125 = calculateSmaSeries(history, 125);
  const rsi = calculateRsiSeries(history, 14);
  const lowerBand = calculateLowerBandSeries(history, 20, 2);
  const macdTrend = calculateMacdTrendSeries(history);
  const { highs, lows } = rollingExtremes(history, 252);

  return history.map((point, index) => {
    // Utan halvårssnitt och årsnivåer går poängen inte att räkna alls.
    if (sma125[index] == null || highs[index] == null || lows[index] == null || rsi[index] == null) return null;

    let score = 0;
    const close = point.close;

    // Grundkriterier som går att räkna punkt i tid.
    if ((highs[index]! - close) / highs[index]! > 0.08) score += 1;
    if ((close - lows[index]!) / lows[index]! <= 0.10) score += 1;
    if (rsi[index]! < 35) score += 1;
    if (close < sma125[index]!) score += 1;

    // Tekniska bonusar.
    if (rsi[index]! < 20) score += 1;
    if (lowerBand[index] != null && close <= lowerBand[index]! * 1.01) score += 1;
    if (macdTrend[index] === 'up') score += 1;

    return score;
  });
}

function abnormalReturn(
  history: EventPricePoint[],
  benchmarkByDate: Map<string, number>,
  from: number,
  to: number,
) {
  if (to >= history.length) return null;
  const start = history[from].close;
  const end = history[to].close;
  if (!(start > 0)) return null;

  const stockReturn = ((end - start) / start) * 100;
  const benchmarkStart = benchmarkByDate.get(history[from].date.slice(0, 10));
  const benchmarkEnd = benchmarkByDate.get(history[to].date.slice(0, 10));
  if (benchmarkStart == null || benchmarkEnd == null || !(benchmarkStart > 0)) return null;

  return stockReturn - ((benchmarkEnd - benchmarkStart) / benchmarkStart) * 100;
}

export function collectObservations(
  history: EventPricePoint[],
  benchmark: EventPricePoint[],
  horizons: number[] = [20, 60, 120],
): RekylObservation[] {
  const scores = computeTechnicalScoreSeries(history);
  const benchmarkByDate = new Map(benchmark.map((point) => [point.date.slice(0, 10), point.close]));
  const observations: RekylObservation[] = [];

  for (let index = 0; index < history.length; index += SAMPLE_EVERY_TRADING_DAYS) {
    const score = scores[index];
    if (score == null) continue;

    const forwardAbnormal: Record<number, number | null> = {};
    let anyMeasured = false;
    for (const horizon of horizons) {
      const value = abnormalReturn(history, benchmarkByDate, index, index + horizon);
      forwardAbnormal[horizon] = value;
      if (value != null) anyMeasured = true;
    }
    if (!anyMeasured) continue;

    observations.push({ index, date: history[index].date.slice(0, 10), score, forwardAbnormal });
  }

  return observations;
}

export interface ScoreBucketResult {
  label: string;
  minScore: number;
  maxScore: number;
  horizons: Record<number, Summary | null>;
}

export interface RekylBacktest {
  /** Alla observationer, oavsett poäng. Utan den går resultaten inte att tolka. */
  baseline: Record<number, Summary | null>;
  buckets: ScoreBucketResult[];
  observations: number;
  tickers: number;
  horizons: number[];
  generatedAt: string;
}

const BUCKETS: { label: string; minScore: number; maxScore: number }[] = [
  { label: 'Inget rekylläge (0-1 p)', minScore: 0, maxScore: 1 },
  { label: 'Svagt (2-3 p)', minScore: 2, maxScore: 3 },
  { label: 'Tydligt (4-5 p)', minScore: 4, maxScore: 5 },
  { label: 'Starkt (6-7 p)', minScore: 6, maxScore: 7 },
];

export function aggregateObservations(
  observations: RekylObservation[],
  tickers: number,
  horizons: number[] = [20, 60, 120],
): RekylBacktest {
  const baseline: Record<number, Summary | null> = {};
  for (const horizon of horizons) {
    baseline[horizon] = summarise(observations.map((observation) => observation.forwardAbnormal[horizon]));
  }

  const buckets = BUCKETS.map((bucket) => {
    const matching = observations.filter(
      (observation) => observation.score >= bucket.minScore && observation.score <= bucket.maxScore,
    );
    const horizonSummaries: Record<number, Summary | null> = {};
    for (const horizon of horizons) {
      horizonSummaries[horizon] = summarise(matching.map((observation) => observation.forwardAbnormal[horizon]));
    }
    return { ...bucket, horizons: horizonSummaries };
  });

  return {
    baseline,
    buckets,
    observations: observations.length,
    tickers,
    horizons,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Skillnaden mot baslinjen är det som avgör. Ett rekylläge som ger +1 % när
 * genomsnittsdagen ger +1,5 % är en signal med negativt värde, trots att talet
 * i sig är positivt.
 */
export function edgeOverBaseline(bucket: ScoreBucketResult, baseline: Record<number, Summary | null>, horizon: number) {
  const bucketSummary = bucket.horizons[horizon];
  const baselineSummary = baseline[horizon];
  if (!bucketSummary || !baselineSummary) return null;
  return bucketSummary.mean - baselineSummary.mean;
}
