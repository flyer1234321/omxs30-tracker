/**
 * Kursen visades tidigare alltid med "kr", även för amerikanska bolag, så
 * AAPL stod som "212,45 kr" i USA- och Tech-vyerna. Valutan följer nu med
 * från Yahoo-quoten.
 */

const CURRENCY_SUFFIXES: Record<string, string> = {
  SEK: 'kr',
  NOK: 'nkr',
  DKK: 'dkr',
  USD: '$',
  EUR: '€',
  GBP: '£',
  GBp: 'p',
  CHF: 'CHF',
  CAD: 'C$',
};

export function currencySuffix(currency: string | null | undefined) {
  if (!currency) return '';
  return CURRENCY_SUFFIXES[currency] ?? currency;
}

export function formatNumber(value: number | null | undefined, decimals = 2) {
  if (value == null || !Number.isFinite(value)) return '-';
  return value.toLocaleString('sv-SE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Kurs med valuta, t.ex. "123,45 kr" eller "212,45 $". */
export function formatPrice(value: number | null | undefined, currency: string | null | undefined, decimals = 2) {
  if (value == null || !Number.isFinite(value)) return '-';
  const suffix = currencySuffix(currency);
  return suffix ? `${formatNumber(value, decimals)} ${suffix}` : formatNumber(value, decimals);
}

/** Procent med tecken, t.ex. "+4,2 %". */
export function formatSignedPercent(value: number | null | undefined, decimals = 1) {
  if (value == null || !Number.isFinite(value)) return '-';
  return `${value >= 0 ? '+' : '-'}${formatNumber(Math.abs(value), decimals)} %`;
}

export function formatPercent(value: number | null | undefined, decimals = 1) {
  if (value == null || !Number.isFinite(value)) return '-';
  return `${formatNumber(value, decimals)} %`;
}
