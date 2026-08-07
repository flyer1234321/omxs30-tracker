export function normalizeDividendYield(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  // Yahoo normally returns a decimal (0.0216), but some Nordic listings return 2.16 for 2.16%.
  return value > 1 ? value / 100 : value;
}

export function roundMarketValue(value: number | null | undefined, decimals = 2) {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
