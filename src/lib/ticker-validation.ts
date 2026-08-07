export const MAX_CUSTOM_TICKERS = 30;

const TICKER_PATTERN = /^[A-Z0-9^][A-Z0-9._=^-]{0,19}$/;

export function normalizeTicker(raw: string) {
  return raw.trim().toUpperCase();
}

export function isValidTicker(raw: string) {
  return TICKER_PATTERN.test(normalizeTicker(raw));
}

export function parseTickerList(raw: string) {
  const seen = new Set<string>();
  const invalid: string[] = [];
  const tickers: string[] = [];

  for (const part of raw.split(',')) {
    const ticker = normalizeTicker(part);
    if (!ticker) continue;
    if (!isValidTicker(ticker)) {
      invalid.push(ticker);
      continue;
    }
    if (!seen.has(ticker)) {
      seen.add(ticker);
      tickers.push(ticker);
    }
  }

  return {
    tickers,
    invalid,
    tooMany: tickers.length > MAX_CUSTOM_TICKERS,
  };
}
