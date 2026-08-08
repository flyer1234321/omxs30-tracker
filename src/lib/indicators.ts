export interface PricePoint {
  close: number;
  volume?: number | null;
  high?: number | null;
  low?: number | null;
  open?: number | null;
}

export interface DatedPricePoint extends PricePoint {
  date: Date | string;
}

export function calculateSMA(history: PricePoint[], period: number) {
  if (history.length < period) return null;
  const recent = history.slice(-period);
  const sum = recent.reduce((acc, curr) => acc + curr.close, 0);
  return sum / period;
}

/**
 * Glidande medelvärde för varje dag i serien, med ett rullande fönster.
 *
 * Tidigare räknades varje dagsvärde om från början av historiken, vilket gav
 * O(n²) arbete per aktie och per snitt. För 252 dagar och tre snitt över ett
 * femtiotal aktier var det den tyngsta delen av API-svaret.
 */
export function calculateSmaSeries(history: PricePoint[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(history.length).fill(null);
  if (period <= 0) return result;

  let sum = 0;
  for (let index = 0; index < history.length; index += 1) {
    sum += history[index].close;
    if (index >= period) sum -= history[index - period].close;
    if (index >= period - 1) result[index] = sum / period;
  }
  return result;
}

export function calculateRSI(history: PricePoint[], period = 14) {
  if (history.length < period + 1) return null;
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = history[i].close - history[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < history.length; i++) {
    const diff = history[i].close - history[i - 1].close;
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - diff) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

export function calculateBollingerBands(history: PricePoint[], period = 20, stdDev = 2) {
  if (history.length < period) return null;
  const recent = history.slice(-period);
  const middle = recent.reduce((acc, curr) => acc + curr.close, 0) / period;
  const variance = recent.reduce((acc, curr) => acc + Math.pow(curr.close - middle, 2), 0) / period;
  const std = Math.sqrt(variance);

  return {
    upper: middle + stdDev * std,
    middle,
    lower: middle - stdDev * std,
  };
}

export function calculateMACD(history: PricePoint[]) {
  if (history.length < 26) return null;

  const ema = (data: number[], period: number) => {
    const result: number[] = [];
    const k = 2 / (period + 1);
    const initialSma = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    result.push(initialSma);
    for (let i = period; i < data.length; i++) {
      result.push(data[i] * k + result[result.length - 1] * (1 - k));
    }
    return result;
  };

  const closes = history.map((h) => h.close);
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);

  const macdLine: number[] = [];
  for (let i = 0; i < ema26.length; i++) {
    const idx12 = ema12.length - ema26.length + i;
    macdLine.push(ema12[idx12] - ema26[i]);
  }

  if (macdLine.length < 9) return null;
  const signalLine = ema(macdLine, 9);

  const histogram: number[] = [];
  for (let i = 0; i < signalLine.length; i++) {
    const idxMacd = macdLine.length - signalLine.length + i;
    histogram.push(macdLine[idxMacd] - signalLine[i]);
  }

  const currentMacd = macdLine[macdLine.length - 1];
  const currentSignal = signalLine[signalLine.length - 1];
  const currentHistogram = histogram[histogram.length - 1];

  let trend: 'up' | 'down' | 'neutral' = 'neutral';
  if (histogram.length >= 3) {
    const len = histogram.length;
    if (currentHistogram > 0 && histogram[len - 1] > histogram[len - 2] && histogram[len - 2] > histogram[len - 3]) {
      trend = 'up';
    } else if (currentHistogram < 0 && histogram[len - 1] < histogram[len - 2] && histogram[len - 2] < histogram[len - 3]) {
      trend = 'down';
    }
  }

  return { macd: currentMacd, signal: currentSignal, histogram: currentHistogram, trend };
}

export function calculateVolatility(history: PricePoint[], period = 20) {
  if (history.length < period + 1) return null;
  const recent = history.slice(-(period + 1));
  const returns: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    returns.push(Math.log(recent[i].close / recent[i - 1].close));
  }

  const mean = returns.reduce((sum, val) => sum + val, 0) / returns.length;
  const variance = returns.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

export function calculateMaxDrawdown(history: PricePoint[], period = 252) {
  const prices = history.slice(-period).map((point) => point.close).filter((price) => price > 0);
  if (prices.length < 2) return null;

  let peak = prices[0];
  let maxDrawdown = 0;
  for (const price of prices) {
    peak = Math.max(peak, price);
    maxDrawdown = Math.max(maxDrawdown, (peak - price) / peak);
  }
  return maxDrawdown * 100;
}

export function calculateBeta(assetHistory: DatedPricePoint[], benchmarkHistory: DatedPricePoint[], period = 252) {
  const benchmarkByDate = new Map(
    benchmarkHistory.map((point) => [new Date(point.date).toISOString().slice(0, 10), point.close]),
  );
  const paired = assetHistory
    .map((point) => ({ date: new Date(point.date).toISOString().slice(0, 10), asset: point.close }))
    .filter((point) => benchmarkByDate.has(point.date))
    .slice(-period)
    .map((point) => ({ asset: point.asset, benchmark: benchmarkByDate.get(point.date)! }));

  if (paired.length < 30) return null;
  const returns = paired.slice(1).map((point, index) => ({
    asset: Math.log(point.asset / paired[index].asset),
    benchmark: Math.log(point.benchmark / paired[index].benchmark),
  })).filter((point) => Number.isFinite(point.asset) && Number.isFinite(point.benchmark));

  if (returns.length < 29) return null;
  const assetMean = returns.reduce((sum, point) => sum + point.asset, 0) / returns.length;
  const benchmarkMean = returns.reduce((sum, point) => sum + point.benchmark, 0) / returns.length;
  const covariance = returns.reduce((sum, point) => sum + (point.asset - assetMean) * (point.benchmark - benchmarkMean), 0) / returns.length;
  const benchmarkVariance = returns.reduce((sum, point) => sum + (point.benchmark - benchmarkMean) ** 2, 0) / returns.length;

  return benchmarkVariance > 0 ? covariance / benchmarkVariance : null;
}

/**
 * Average True Range: genomsnittlig daglig rörelse i kronor, inklusive gap
 * mellan stängning och nästa dags öppning. ATR används för att sätta stop loss
 * på ett avstånd som är anpassat till hur mycket aktien faktiskt rör sig,
 * istället för en godtycklig procentsats.
 */
export function calculateATR(history: PricePoint[], period = 14) {
  if (history.length < period + 1) return null;

  const trueRanges: number[] = [];
  for (let index = 1; index < history.length; index += 1) {
    const current = history[index];
    const previousClose = history[index - 1].close;
    const high = current.high ?? Math.max(current.close, previousClose);
    const low = current.low ?? Math.min(current.close, previousClose);
    trueRanges.push(Math.max(high - low, Math.abs(high - previousClose), Math.abs(low - previousClose)));
  }
  if (trueRanges.length < period) return null;

  // Wilders utjämning, samma metod som i RSI ovan.
  let atr = trueRanges.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  for (let index = period; index < trueRanges.length; index += 1) {
    atr = (atr * (period - 1) + trueRanges[index]) / period;
  }
  return Number.isFinite(atr) && atr > 0 ? atr : null;
}

/**
 * Relativ styrka: aktiens avkastning minus jämförelseindexets, i procentenheter
 * över perioden. Positivt tal betyder att aktien gått bättre än index.
 *
 * Jämförelseindexets historik hämtas redan för beta-beräkningen, så det här
 * måttet kostar inga extra anrop.
 */
export function calculateRelativeStrength(
  assetHistory: DatedPricePoint[],
  benchmarkHistory: DatedPricePoint[],
  period = 63,
) {
  const benchmarkByDate = new Map(
    benchmarkHistory.map((point) => [new Date(point.date).toISOString().slice(0, 10), point.close]),
  );
  const paired = assetHistory
    .map((point) => ({ date: new Date(point.date).toISOString().slice(0, 10), asset: point.close }))
    .filter((point) => benchmarkByDate.has(point.date))
    .slice(-period);

  if (paired.length < Math.min(period, 20)) return null;

  const first = paired[0];
  const last = paired.at(-1)!;
  const firstBenchmark = benchmarkByDate.get(first.date)!;
  const lastBenchmark = benchmarkByDate.get(last.date)!;
  if (!(first.asset > 0) || !(firstBenchmark > 0)) return null;

  const assetReturn = ((last.asset - first.asset) / first.asset) * 100;
  const benchmarkReturn = ((lastBenchmark - firstBenchmark) / firstBenchmark) * 100;
  return assetReturn - benchmarkReturn;
}

/**
 * Rullande varianter av indikatorerna ovan.
 *
 * En punkt-i-tid-mätning behöver varje indikators värde för varje dag i
 * historiken. Att anropa engångsfunktionerna på en växande delmängd hade
 * kostat O(n²) per indikator; över tio år och trettio bolag blir det
 * ohanterligt. Serierna nedan räknas i ett svep.
 */

export function calculateRsiSeries(history: PricePoint[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(history.length).fill(null);
  if (history.length < period + 1) return result;

  let gains = 0;
  let losses = 0;
  for (let index = 1; index <= period; index += 1) {
    const diff = history[index].close - history[index - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  const rsiFrom = (gain: number, loss: number) => (loss === 0 ? 100 : 100 - 100 / (1 + gain / loss));
  result[period] = rsiFrom(avgGain, avgLoss);

  for (let index = period + 1; index < history.length; index += 1) {
    const diff = history[index].close - history[index - 1].close;
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - diff) / period;
    }
    result[index] = rsiFrom(avgGain, avgLoss);
  }

  return result;
}

/** Nedre Bollingerbandet för varje dag. */
export function calculateLowerBandSeries(history: PricePoint[], period = 20, stdDev = 2): (number | null)[] {
  const result: (number | null)[] = new Array(history.length).fill(null);
  let sum = 0;
  let sumSquares = 0;

  for (let index = 0; index < history.length; index += 1) {
    const value = history[index].close;
    sum += value;
    sumSquares += value * value;

    if (index >= period) {
      const dropped = history[index - period].close;
      sum -= dropped;
      sumSquares -= dropped * dropped;
    }

    if (index >= period - 1) {
      const mean = sum / period;
      // Variansen ur summorna: E[x²] - E[x]². Klamras mot noll eftersom
      // avrundningsfel annars kan ge ett minimalt negativt tal.
      const variance = Math.max(sumSquares / period - mean * mean, 0);
      result[index] = mean - stdDev * Math.sqrt(variance);
    }
  }

  return result;
}

/** MACD-histogrammets riktning för varje dag, med samma regel som calculateMACD. */
export function calculateMacdTrendSeries(history: PricePoint[]): ('up' | 'down' | 'neutral' | null)[] {
  const result: ('up' | 'down' | 'neutral' | null)[] = new Array(history.length).fill(null);
  if (history.length < 35) return result;

  const emaSeries = (values: number[], period: number) => {
    const output: (number | null)[] = new Array(values.length).fill(null);
    const k = 2 / (period + 1);
    let previous = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
    output[period - 1] = previous;
    for (let index = period; index < values.length; index += 1) {
      previous = values[index] * k + previous * (1 - k);
      output[index] = previous;
    }
    return output;
  };

  const closes = history.map((point) => point.close);
  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);

  const macdLine: (number | null)[] = closes.map((_, index) => (
    ema12[index] != null && ema26[index] != null ? ema12[index]! - ema26[index]! : null
  ));

  const defined = macdLine.map((value, index) => ({ value, index })).filter((entry) => entry.value != null);
  if (defined.length < 9) return result;

  const signal = emaSeries(defined.map((entry) => entry.value!), 9);
  const histogram: (number | null)[] = new Array(history.length).fill(null);
  defined.forEach((entry, position) => {
    if (signal[position] != null) histogram[entry.index] = entry.value! - signal[position]!;
  });

  for (let index = 2; index < history.length; index += 1) {
    const current = histogram[index];
    const previous = histogram[index - 1];
    const before = histogram[index - 2];
    if (current == null || previous == null || before == null) continue;

    result[index] = current > 0 && current > previous && previous > before
      ? 'up'
      : current < 0 && current < previous && previous < before
        ? 'down'
        : 'neutral';
  }

  return result;
}

/** Högsta respektive lägsta stängning inom ett bakåtblickande fönster. */
export function rollingExtremes(history: PricePoint[], period = 252) {
  const highs: (number | null)[] = new Array(history.length).fill(null);
  const lows: (number | null)[] = new Array(history.length).fill(null);

  for (let index = 0; index < history.length; index += 1) {
    const start = Math.max(0, index - period + 1);
    let high = -Infinity;
    let low = Infinity;
    for (let cursor = start; cursor <= index; cursor += 1) {
      const value = history[cursor].close;
      if (value > high) high = value;
      if (value < low) low = value;
    }
    // Kräver ett halvår för att vara meningsfullt som års-extrem.
    if (index >= 125) {
      highs[index] = high;
      lows[index] = low;
    }
  }

  return { highs, lows };
}
