const MAX_FAVORITES = 60;

export function normalizeFavoriteTickers(tickers: string[]) {
  return Array.from(new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean))).slice(0, MAX_FAVORITES);
}
