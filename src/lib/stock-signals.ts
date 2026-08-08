import type { StockData, StockSignal } from '@/types/stock';

/**
 * Hur många handelsdagar tillbaka en korsning fortfarande är intressant.
 * Tidigare upptäcktes en Golden Cross bara om den inträffade på exakt den
 * sista stapeln, vilket innebar att signalen syntes i högst ett dygn.
 */
const CROSS_LOOKBACK_DAYS = 10;

/** Rapportperioder är den vanligaste orsaken till plötsliga kursgap. */
const EARNINGS_WARNING_DAYS = 7;

export function daysUntilEarnings(earningsTimestamp: number | null | undefined, now = Date.now()) {
  if (!earningsTimestamp) return null;
  // Yahoo levererar ibland sekunder, ibland millisekunder.
  const milliseconds = earningsTimestamp < 1e12 ? earningsTimestamp * 1000 : earningsTimestamp;
  const days = Math.round((milliseconds - now) / (24 * 60 * 60 * 1000));
  return days >= -1 && days <= 400 ? days : null;
}

export function deriveStockSignals(stock: StockData, now = Date.now()): StockSignal[] {
  const latest = stock.chartHistory.at(-1);
  const observedAt = latest?.date ?? new Date().toISOString();
  const signals: StockSignal[] = [];

  const history = stock.chartHistory;
  for (let index = history.length - 1; index >= 1 && index >= history.length - CROSS_LOOKBACK_DAYS; index -= 1) {
    const current = history[index];
    const previous = history[index - 1];
    if (
      current.sma50 != null && current.sma200 != null &&
      previous.sma50 != null && previous.sma200 != null &&
      current.sma50 > current.sma200 && previous.sma50 <= previous.sma200
    ) {
      const daysAgo = history.length - 1 - index;
      signals.push({
        kind: 'goldenCross',
        label: daysAgo === 0 ? 'GC' : `GC ${daysAgo}d`,
        detail: daysAgo === 0
          ? 'SMA 50 korsade upp genom SMA 200 senaste handelsdagen'
          : `SMA 50 korsade upp genom SMA 200 för ${daysAgo} handelsdagar sedan`,
        tone: 'positive',
        observedAt: current.date,
      });
      break;
    }
  }

  const volumeRatio = stock.latestVolume != null && stock.avgVolume20 != null && stock.avgVolume20 > 0
    ? stock.latestVolume / stock.avgVolume20
    : null;
  if (volumeRatio != null && volumeRatio >= 2) {
    signals.push({
      kind: 'volumeSpike',
      label: `VOL ${volumeRatio.toFixed(1)}x`,
      detail: 'Volymen är minst 200% av föregående 20 handelsdagars snitt',
      tone: 'attention',
      observedAt,
    });
  }

  const medianPE = stock.valuation?.trailingPEProxyMedian;
  if (stock.trailingPE != null && stock.trailingPE > 0 && medianPE != null && medianPE > 0 && stock.trailingPE <= medianPE * 0.8) {
    const discount = (1 - stock.trailingPE / medianPE) * 100;
    signals.push({
      kind: 'valueDiscount',
      label: `P/E-proxy -${discount.toFixed(0)}%`,
      detail: 'P/E är minst 20 % under en prisbaserad årsproxy där dagens vinst per aktie hålls konstant',
      tone: 'value',
      observedAt,
    });
  }

  const earningsDays = daysUntilEarnings(stock.earningsTimestamp, now);
  if (earningsDays != null && earningsDays >= 0 && earningsDays <= EARNINGS_WARNING_DAYS) {
    signals.push({
      kind: 'earningsSoon',
      label: earningsDays === 0 ? 'RAPPORT IDAG' : `RAPPORT ${earningsDays}d`,
      detail: earningsDays === 0
        ? 'Bolaget rapporterar i dag. Kursrörelser kring rapport följer sällan tekniska signaler.'
        : `Rapport om ${earningsDays} ${earningsDays === 1 ? 'dag' : 'dagar'}. Tekniska signaler väger lättare strax före en rapport.`,
      tone: 'attention',
      observedAt,
    });
  }

  return signals;
}
