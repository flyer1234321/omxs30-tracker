import type { StockData } from '@/types/stock';
import { assessValuation } from '@/lib/valuation';

export function getBullPoints(stock: StockData): string[] {
  const points: string[] = [];
  if (stock.sma125 && stock.currentPrice > stock.sma125) points.push('Handlas över 6-månaderssnittet');
  if (stock.sma200 && stock.currentPrice > stock.sma200) points.push('Handlas över årsgenomsnittet');
  if (stock.rsi && stock.rsi < 40 && stock.rsi > 20) points.push('RSI visar svagt kortsiktigt momentum; ingen vändning är bekräftad');
  if (stock.dividendYield && stock.dividendYield > 0.03) points.push(`Direktavkastning ${(stock.dividendYield * 100).toFixed(1)} % före eventuell ändring`);
  const valuation = assessValuation(stock);
  if (valuation.tone === 'positive') points.push(valuation.summary);
  if (stock.macdData?.trend === 'up') points.push('MACD-momentum har förbättrats');
  if (stock.latestVolume && stock.avgVolume20 && stock.latestVolume > stock.avgVolume20 * 1.3) points.push('Ökande handelsvolym');
  return points;
}

export function getBearPoints(stock: StockData): string[] {
  const points: string[] = [];
  if (stock.sma125 && stock.currentPrice < stock.sma125) points.push('Handlas under 6-månaderssnittet');
  if (stock.sma200 && stock.currentPrice < stock.sma200) points.push('Handlas under årsgenomsnittet');
  if (stock.rsi && stock.rsi > 70) points.push(`Överköpt (RSI ${stock.rsi.toFixed(1)})`);
  if (stock.rsi && stock.rsi < 20) points.push('Extremt översåld - risk för ytterligare fall');
  const valuation = assessValuation(stock);
  if (valuation.tone === 'negative') points.push(valuation.summary);
  if (stock.volatility && stock.volatility > 40) points.push(`Hög volatilitet (${stock.volatility.toFixed(1)}%)`);
  if (stock.macdData?.trend === 'down') points.push('Negativt momentum (MACD)');
  if (stock.currentPrice && stock.fiftyTwoWeekLow && stock.currentPrice < stock.fiftyTwoWeekLow * 1.05) points.push('Nära 52-veckors lägsta');
  return points;
}

export interface TrendInsight {
  title: string;
  text: string;
  color: 'positive' | 'negative' | 'attention';
  icon: string;
}

export function getTrendInsight(stock: StockData): TrendInsight | null {
  if (!stock.sma125 || !stock.currentPrice) return null;
  const diffPercent = ((stock.currentPrice - stock.sma125) / stock.sma125) * 100;
  if (Math.abs(diffPercent) <= 2) {
    return {
      title: 'Testar brytpunkt (SMA 125)', color: 'attention', icon: '!',
      text: `Aktien handlas på ${stock.currentPrice.toFixed(2)} kr, nära halvårstrenden på ${stock.sma125.toFixed(2)} kr. Ett utbrott uppåt under hög volym kan bekräfta trendstyrka, medan ett brott nedåt visar försvagning.`,
    };
  }
  if (stock.currentPrice > stock.sma125) {
    return {
      title: 'Positiv trend', color: 'positive', icon: '+',
      text: `Kursen (${stock.currentPrice.toFixed(2)} kr) handlas över SMA 125 (${stock.sma125.toFixed(2)} kr). Snittet kan bevakas som en referensnivå, men håller inte alltid vid en nedgång.`,
    };
  }
  return {
    title: 'Negativ trend', color: 'negative', icon: '-',
    text: `Kursen (${stock.currentPrice.toFixed(2)} kr) handlas under SMA 125 (${stock.sma125.toFixed(2)} kr). Snittet kan bevakas som en referensnivå; ett återtag behöver bekräftas av senare kurser.`,
  };
}
