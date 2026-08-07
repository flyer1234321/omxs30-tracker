/**
 * Händelsestudie kring rapporter.
 *
 * Frågan modulen svarar på: när ett bolag överraskat positivt eller negativt
 * med sin vinst, vad hände med kursen därefter? Det är en mätning av vad som
 * redan inträffat, inte en prognos.
 *
 * Två metodval styr allt annat här:
 *
 * 1. Avkastningen mäts mot jämförelseindex. Steg en aktie 6 % en vecka då hela
 *    börsen steg 5 % har rapporten förklarat en procentenhet, inte sex. Utan
 *    den justeringen mäter man mest marknadsklimatet.
 *
 * 2. Reaktionen på rapportdagen hålls isär från driften efteråt. Den första är
 *    marknadens omedelbara omprövning och går inte att handla på i efterhand.
 *    Den andra är det intressanta: fortsätter kursen i samma riktning i veckor
 *    efter att nyheten är känd av alla?
 */

export interface EventPricePoint {
  date: string;
  close: number;
  volume?: number | null;
}

export type SurpriseBucket = 'stor_positiv' | 'positiv' | 'neutral' | 'negativ' | 'stor_negativ';

export const SURPRISE_BUCKET_LABELS: Record<SurpriseBucket, string> = {
  stor_positiv: 'Stor positiv överraskning (över 10 %)',
  positiv: 'Positiv överraskning (2-10 %)',
  neutral: 'Som väntat (inom 2 %)',
  negativ: 'Negativ överraskning (2-10 %)',
  stor_negativ: 'Stor negativ överraskning (över 10 %)',
};

export function bucketForSurprise(surprisePercent: number): SurpriseBucket {
  if (surprisePercent > 10) return 'stor_positiv';
  if (surprisePercent > 2) return 'positiv';
  if (surprisePercent >= -2) return 'neutral';
  if (surprisePercent >= -10) return 'negativ';
  return 'stor_negativ';
}

/**
 * Yahoo lämnar ut kvartalets slutdatum, inte den dag rapporten offentliggjordes.
 * Rapportdagen är däremot nästan alltid årets tydligaste volymtopp för bolaget,
 * så den letas upp i fönstret efter kvartalsskiftet.
 *
 * Heuristiken kan slå fel, och därför returneras volymkvoten tillsammans med
 * dagen: anropande kod kan kräva en tydlig topp innan händelsen används.
 */
export function findAnnouncementIndex(
  history: EventPricePoint[],
  quarterEnd: string | Date,
  options: { minLagDays?: number; maxLagDays?: number; volumeLookback?: number } = {},
) {
  const { minLagDays = 10, maxLagDays = 80, volumeLookback = 20 } = options;
  const quarterEndTime = new Date(quarterEnd).getTime();
  if (!Number.isFinite(quarterEndTime)) return null;

  const dayMs = 24 * 60 * 60 * 1000;
  const windowStart = quarterEndTime + minLagDays * dayMs;
  const windowEnd = quarterEndTime + maxLagDays * dayMs;

  let best: { index: number; volumeRatio: number } | null = null;

  for (let index = 0; index < history.length; index += 1) {
    const time = new Date(history[index].date).getTime();
    if (time < windowStart || time > windowEnd) continue;

    const volume = history[index].volume;
    if (volume == null || volume <= 0) continue;

    const priorStart = Math.max(0, index - volumeLookback);
    const prior = history.slice(priorStart, index).filter((point) => (point.volume ?? 0) > 0);
    if (prior.length < 5) continue;

    const averageVolume = prior.reduce((sum, point) => sum + (point.volume ?? 0), 0) / prior.length;
    if (!(averageVolume > 0)) continue;

    const volumeRatio = volume / averageVolume;
    if (!best || volumeRatio > best.volumeRatio) best = { index, volumeRatio };
  }

  return best;
}

function returnBetween(history: EventPricePoint[], fromIndex: number, toIndex: number) {
  const from = history[fromIndex]?.close;
  const to = history[toIndex]?.close;
  if (from == null || to == null || !(from > 0)) return null;
  return ((to - from) / from) * 100;
}

/** Slår upp indexets stängning på ett givet datum, eller närmast föregående. */
function benchmarkIndexForDate(benchmarkByDate: Map<string, number>, date: string) {
  return benchmarkByDate.get(date.slice(0, 10)) ?? null;
}

export interface EventOutcome {
  /** Rapportdagens egen avkastning: marknadens omedelbara reaktion. */
  reactionPercent: number | null;
  /** Överavkastning per horisont, räknad från rapportdagens stängning. */
  driftPercent: Record<number, number | null>;
  abnormalDriftPercent: Record<number, number | null>;
}

export function measureEvent(
  history: EventPricePoint[],
  benchmark: EventPricePoint[],
  eventIndex: number,
  horizons: number[] = [1, 5, 20, 60],
): EventOutcome {
  const benchmarkByDate = new Map(benchmark.map((point) => [point.date.slice(0, 10), point.close]));

  const reactionPercent = eventIndex > 0 ? returnBetween(history, eventIndex - 1, eventIndex) : null;

  const driftPercent: Record<number, number | null> = {};
  const abnormalDriftPercent: Record<number, number | null> = {};

  for (const horizon of horizons) {
    const targetIndex = eventIndex + horizon;
    const stockReturn = targetIndex < history.length ? returnBetween(history, eventIndex, targetIndex) : null;
    driftPercent[horizon] = stockReturn;

    if (stockReturn == null) {
      abnormalDriftPercent[horizon] = null;
      continue;
    }

    const from = benchmarkIndexForDate(benchmarkByDate, history[eventIndex].date);
    const to = benchmarkIndexForDate(benchmarkByDate, history[targetIndex].date);
    abnormalDriftPercent[horizon] = from != null && to != null && from > 0
      ? stockReturn - ((to - from) / from) * 100
      : null;
  }

  return { reactionPercent, driftPercent, abnormalDriftPercent };
}

export interface Summary {
  n: number;
  mean: number;
  median: number;
  /** Andel positiva utfall, 0-100. */
  hitRate: number;
  standardError: number;
  /**
   * Medelvärdet delat med sitt medelfel. Tumregel: under 2 går resultatet inte
   * att skilja från slumpen med det här stickprovet.
   */
  tStat: number;
}

export function summarise(values: (number | null)[]): Summary | null {
  const observations = values.filter((value): value is number => value != null && Number.isFinite(value));
  if (!observations.length) return null;

  const n = observations.length;
  const mean = observations.reduce((sum, value) => sum + value, 0) / n;
  const sorted = [...observations].sort((a, b) => a - b);
  const middle = Math.floor(n / 2);
  const median = n % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  const hitRate = (observations.filter((value) => value > 0).length / n) * 100;

  const variance = n > 1
    ? observations.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1)
    : 0;
  const standardError = n > 1 ? Math.sqrt(variance / n) : 0;
  const tStat = standardError > 0 ? mean / standardError : 0;

  return { n, mean, median, hitRate, standardError, tStat };
}

/**
 * Ett resultat är värt att titta på först när stickprovet är rimligt och
 * medelvärdet går att skilja från noll. Gränserna är medvetet stränga: med få
 * händelser och många möjliga uppdelningar är slumpmässiga utslag regel.
 */
export function isStatisticallyInteresting(summary: Summary | null, minimumObservations = 20) {
  return Boolean(summary && summary.n >= minimumObservations && Math.abs(summary.tStat) >= 2);
}
