export interface ProFilter {
  rsiMax?: number;
  rsiMin?: number;
  peMax?: number;
  peMin?: number;
  divYieldMin?: number;
  volatilityMax?: number;
  riskRewardMin?: number;
  aboveSMA50?: boolean;
  aboveSMA125?: boolean;
  aboveSMA200?: boolean;
  belowSMA125?: boolean;
  volAboveAvg?: boolean;
  near52wHigh?: boolean;
  near52wLow?: boolean;
}

export interface FilterableStock {
  rsi?: number | null;
  trailingPE?: number | null;
  dividendYield?: number | null;
  sma50?: number | null;
  sma125?: number | null;
  sma200?: number | null;
  currentPrice: number;
  latestVolume?: number | null;
  avgVolume20?: number | null;
  fiftyTwoWeekHigh?: number | null;
  fiftyTwoWeekLow?: number | null;
  volatility?: number | null;
  riskRewardScore?: number | null;
}

export function applyProFilter<T extends FilterableStock>(data: T[], filter: ProFilter): T[] {
  return data.filter((item) => {
    if (filter.rsiMax != null && (item.rsi == null || item.rsi > filter.rsiMax)) return false;
    if (filter.rsiMin != null && (item.rsi == null || item.rsi < filter.rsiMin)) return false;
    if (filter.peMax != null && (item.trailingPE == null || item.trailingPE <= 0 || item.trailingPE > filter.peMax)) return false;
    if (filter.peMin != null && (item.trailingPE == null || item.trailingPE < filter.peMin)) return false;
    if (filter.divYieldMin != null) {
      const yieldPct = (item.dividendYield || 0) * 100;
      if (yieldPct < filter.divYieldMin) return false;
    }
    if (filter.volatilityMax != null && (item.volatility == null || item.volatility > filter.volatilityMax)) return false;
    if (filter.riskRewardMin != null && (item.riskRewardScore == null || item.riskRewardScore < filter.riskRewardMin)) return false;
    if (filter.aboveSMA50 && !(item.sma50 && item.currentPrice > item.sma50)) return false;
    if (filter.aboveSMA125 && !(item.sma125 && item.currentPrice > item.sma125)) return false;
    if (filter.aboveSMA200 && !(item.sma200 && item.currentPrice > item.sma200)) return false;
    if (filter.belowSMA125 && !(item.sma125 && item.currentPrice < item.sma125)) return false;
    if (filter.volAboveAvg && !(item.latestVolume && item.avgVolume20 && item.latestVolume > item.avgVolume20 * 1.5)) return false;
    if (filter.near52wHigh && !(item.fiftyTwoWeekHigh && item.currentPrice > item.fiftyTwoWeekHigh * 0.95)) return false;
    if (filter.near52wLow && !(item.fiftyTwoWeekLow && item.currentPrice < item.fiftyTwoWeekLow * 1.05)) return false;
    return true;
  });
}

export function getActiveFilterCount(filter: ProFilter): number {
  let count = 0;
  if (filter.rsiMax != null) count++;
  if (filter.rsiMin != null) count++;
  if (filter.peMax != null) count++;
  if (filter.peMin != null) count++;
  if (filter.divYieldMin != null) count++;
  if (filter.volatilityMax != null) count++;
  if (filter.riskRewardMin != null) count++;
  if (filter.aboveSMA50) count++;
  if (filter.aboveSMA125) count++;
  if (filter.aboveSMA200) count++;
  if (filter.belowSMA125) count++;
  if (filter.volAboveAvg) count++;
  if (filter.near52wHigh) count++;
  if (filter.near52wLow) count++;
  return count;
}
