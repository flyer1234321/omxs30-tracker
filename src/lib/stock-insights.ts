import type { StockData } from '@/types/stock';
import { assessValuation } from '@/lib/valuation';
import type { AppLanguage } from '@/lib/language';

export function getBullPoints(stock: StockData, language: AppLanguage = 'sv'): string[] {
  const en = language === 'en';
  const points: string[] = [];
  if (stock.sma125 && stock.currentPrice > stock.sma125) points.push(en ? 'Trades above the six-month average' : 'Handlas över 6-månaderssnittet');
  if (stock.sma200 && stock.currentPrice > stock.sma200) points.push(en ? 'Trades above the one-year average' : 'Handlas över årsgenomsnittet');
  if (stock.rsi && stock.rsi < 40 && stock.rsi > 20) points.push(en ? 'RSI shows weak short-term momentum; no reversal is confirmed' : 'RSI visar svagt kortsiktigt momentum; ingen vändning är bekräftad');
  if (stock.dividendYield && stock.dividendYield > 0.03) points.push(en ? `Indicated dividend yield ${(stock.dividendYield * 100).toFixed(1)}% before any change` : `Direktavkastning ${(stock.dividendYield * 100).toFixed(1)} % före eventuell ändring`);
  const valuation = assessValuation(stock, language);
  if (valuation.tone === 'positive') points.push(valuation.summary);
  if (stock.macdData?.trend === 'up') points.push(en ? 'MACD momentum has improved' : 'MACD-momentum har förbättrats');
  if (stock.latestVolume && stock.avgVolume20 && stock.latestVolume > stock.avgVolume20 * 1.3) points.push(en ? 'Increasing trading volume' : 'Ökande handelsvolym');
  return points;
}

export function getBearPoints(stock: StockData, language: AppLanguage = 'sv'): string[] {
  const en = language === 'en';
  const points: string[] = [];
  if (stock.sma125 && stock.currentPrice < stock.sma125) points.push(en ? 'Trades below the six-month average' : 'Handlas under 6-månaderssnittet');
  if (stock.sma200 && stock.currentPrice < stock.sma200) points.push(en ? 'Trades below the one-year average' : 'Handlas under årsgenomsnittet');
  if (stock.rsi && stock.rsi > 70) points.push(en ? `Overbought (RSI ${stock.rsi.toFixed(1)})` : `Överköpt (RSI ${stock.rsi.toFixed(1)})`);
  if (stock.rsi && stock.rsi < 20) points.push(en ? 'Extremely oversold - risk of further decline' : 'Extremt översåld - risk för ytterligare fall');
  const valuation = assessValuation(stock, language);
  if (valuation.tone === 'negative') points.push(valuation.summary);
  if (stock.volatility && stock.volatility > 40) points.push(en ? `High volatility (${stock.volatility.toFixed(1)}%)` : `Hög volatilitet (${stock.volatility.toFixed(1)}%)`);
  if (stock.macdData?.trend === 'down') points.push(en ? 'Negative momentum (MACD)' : 'Negativt momentum (MACD)');
  if (stock.currentPrice && stock.fiftyTwoWeekLow && stock.currentPrice < stock.fiftyTwoWeekLow * 1.05) points.push(en ? 'Near the 52-week low' : 'Nära 52-veckors lägsta');
  return points;
}

export interface TrendInsight {
  title: string;
  text: string;
  color: 'positive' | 'negative' | 'attention';
  icon: string;
}

export function getTrendInsight(stock: StockData, language: AppLanguage = 'sv'): TrendInsight | null {
  const en = language === 'en';
  if (!stock.sma125 || !stock.currentPrice) return null;
  const diffPercent = ((stock.currentPrice - stock.sma125) / stock.sma125) * 100;
  if (Math.abs(diffPercent) <= 2) {
    return {
      title: en ? 'Testing a pivot (SMA 125)' : 'Testar brytpunkt (SMA 125)', color: 'attention', icon: '!',
      text: en ? `The share trades at ${stock.currentPrice.toFixed(2)} kr, close to the six-month trend at ${stock.sma125.toFixed(2)} kr. An upside breakout on high volume may confirm trend strength, while a downside break signals weakness.` : `Aktien handlas på ${stock.currentPrice.toFixed(2)} kr, nära halvårstrenden på ${stock.sma125.toFixed(2)} kr. Ett utbrott uppåt under hög volym kan bekräfta trendstyrka, medan ett brott nedåt visar försvagning.`,
    };
  }
  if (stock.currentPrice > stock.sma125) {
    return {
      title: en ? 'Positive trend' : 'Positiv trend', color: 'positive', icon: '+',
      text: en ? `The price (${stock.currentPrice.toFixed(2)} kr) trades above SMA 125 (${stock.sma125.toFixed(2)} kr). The average can be monitored as a reference level, but does not always hold during a decline.` : `Kursen (${stock.currentPrice.toFixed(2)} kr) handlas över SMA 125 (${stock.sma125.toFixed(2)} kr). Snittet kan bevakas som en referensnivå, men håller inte alltid vid en nedgång.`,
    };
  }
  return {
    title: en ? 'Negative trend' : 'Negativ trend', color: 'negative', icon: '-',
    text: en ? `The price (${stock.currentPrice.toFixed(2)} kr) trades below SMA 125 (${stock.sma125.toFixed(2)} kr). The average can be monitored as a reference level; a recovery needs confirmation from later prices.` : `Kursen (${stock.currentPrice.toFixed(2)} kr) handlas under SMA 125 (${stock.sma125.toFixed(2)} kr). Snittet kan bevakas som en referensnivå; ett återtag behöver bekräftas av senare kurser.`,
  };
}
