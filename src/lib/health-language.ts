import type { AppLanguage } from '@/lib/language';
import type { StockData } from '@/types/stock';

const labels: Record<string, string> = {
  'Tjänar företaget pengar?': 'Is the company profitable?',
  'Betalar utdelning?': 'Does it pay a dividend?',
  'Har aktien fallit kraftigt?': 'Has the share fallen sharply?',
  'Nära botten?': 'Near the low?',
  'Översåld (RSI)?': 'Oversold (RSI)?',
  'Under glidande medelvärde?': 'Below its moving average?',
  'Extremt översåld (RSI under 20)': 'Extremely oversold (RSI below 20)',
  'Vid nedre Bollingerbandet': 'At the lower Bollinger Band',
  'Positiv momentumvändning (MACD)': 'Positive momentum turn (MACD)',
};

export function healthLabel(label: string, language: AppLanguage) {
  return language === 'en' ? labels[label] ?? label : label;
}

export function healthDetail(detail: string, language: AppLanguage) {
  if (language !== 'en') return detail;
  return detail
    .replace('Negativt/Saknas', 'Negative/unavailable')
    .replace('Ingen utdelning', 'No dividend')
    .replace('Direktavkastning:', 'Dividend yield:')
    .replace('Faller ', 'Down ')
    .replace(' från botten', ' from the low')
    .replace(' under', ' below')
    .replace('Över SMA', 'Above SMA')
    .replace('Nedre band:', 'Lower band:')
    .replace('Stigande histogram', 'Rising histogram')
    .replace('Fallande histogram', 'Falling histogram')
    .replace('Neutralt', 'Neutral');
}

export function healthSummary(stock: StockData, language: AppLanguage) {
  const health = stock.healthCheck;
  if (!health || language !== 'en') return health?.summary ?? '';
  const parts: string[] = [];
  if (stock.sma125) {
    const difference = Math.abs(((stock.currentPrice - stock.sma125) / stock.sma125) * 100).toFixed(1);
    parts.push(`${stock.companyName} trades ${difference}% ${stock.currentPrice < stock.sma125 ? 'below' : 'above'} its six-month average.`);
  } else {
    parts.push(`${stock.companyName} trades close to its available average.`);
  }
  if (stock.rsi != null && stock.rsi < 30) parts.push(`RSI is ${stock.rsi.toFixed(0)}, which is commonly described as oversold.`);
  if (stock.dividendYield) parts.push(`Dividend yield is ${(stock.dividendYield * 100).toFixed(1)}%.`);
  const risk = ({ Låg: 'low', Medel: 'medium', Hög: 'high' } as Record<string, string>)[health.riskLevel] ?? health.riskLevel;
  parts.push(`Historical risk is assessed as ${risk}.`);
  if (health.grade === 'A' || health.grade === 'B') parts.push('The pullback is clear, but the model does not confirm that the price has turned.');
  else if (health.grade === 'C') parts.push('The pullback is moderate and gives no clear conclusion about the next move.');
  else parts.push('The model currently sees no clear pullback.');
  return parts.join(' ');
}
