export interface PricePoint {
  close: number;
  volume?: number | null;
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
