import type { StockData, StockSignal } from '@/types/stock';

export function deriveStockSignals(stock: StockData): StockSignal[] {
  const latest = stock.chartHistory.at(-1);
  const previous = stock.chartHistory.at(-2);
  const observedAt = latest?.date ?? new Date().toISOString();
  const signals: StockSignal[] = [];

  if (
    latest?.sma50 != null && latest.sma200 != null &&
    previous?.sma50 != null && previous.sma200 != null &&
    latest.sma50 > latest.sma200 && previous.sma50 <= previous.sma200
  ) {
    signals.push({
      kind: 'goldenCross',
      label: 'GC',
      detail: 'SMA 50 korsade upp genom SMA 200',
      tone: 'positive',
      observedAt,
    });
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

  const medianPE = stock.valuation?.trailingPE5yMedian;
  if (stock.trailingPE != null && stock.trailingPE > 0 && medianPE != null && medianPE > 0 && stock.trailingPE <= medianPE * 0.8) {
    const discount = (1 - stock.trailingPE / medianPE) * 100;
    signals.push({
      kind: 'valueDiscount',
      label: `P/E -${discount.toFixed(0)}%`,
      detail: 'P/E är minst 20% under bolagets femåriga median',
      tone: 'value',
      observedAt,
    });
  }

  return signals;
}
