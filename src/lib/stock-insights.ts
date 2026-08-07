import type { StockData } from '@/types/stock';

export function getBullPoints(stock: StockData): string[] {
  const points: string[] = [];
  if (stock.sma125 && stock.currentPrice > stock.sma125) points.push('Handlas över 6-månaderssnittet');
  if (stock.sma200 && stock.currentPrice > stock.sma200) points.push('Handlas över årsgenomsnittet');
  if (stock.rsi && stock.rsi < 40 && stock.rsi > 20) points.push('RSI indikerar potentiell vändning');
  if (stock.dividendYield && stock.dividendYield > 0.03) points.push(`Stark direktavkastning (${(stock.dividendYield * 100).toFixed(1)}%)`);
  if (stock.trailingPE && stock.trailingPE < 15 && stock.trailingPE > 0) points.push(`Låg värdering (P/E ${stock.trailingPE.toFixed(1)})`);
  if (stock.macdData?.trend === 'up') points.push('Positiv momentumvändning (MACD)');
  if (stock.latestVolume && stock.avgVolume20 && stock.latestVolume > stock.avgVolume20 * 1.3) points.push('Ökande handelsvolym');
  return points;
}

export function getBearPoints(stock: StockData): string[] {
  const points: string[] = [];
  if (stock.sma125 && stock.currentPrice < stock.sma125) points.push('Handlas under 6-månaderssnittet');
  if (stock.sma200 && stock.currentPrice < stock.sma200) points.push('Handlas under årsgenomsnittet');
  if (stock.rsi && stock.rsi > 70) points.push(`Överköpt (RSI ${stock.rsi.toFixed(1)})`);
  if (stock.rsi && stock.rsi < 20) points.push('Extremt översåld - risk för ytterligare fall');
  if (stock.trailingPE && stock.trailingPE > 30) points.push(`Hög värdering (P/E ${stock.trailingPE.toFixed(1)})`);
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
      text: `Aktien handlas på ${stock.currentPrice.toFixed(2)} kr, nära halvårstrenden på ${stock.sma125.toFixed(2)} kr. Ett utbrott uppåt under hög volym kan vara en köpsignal, medan ett brott nedåt kan vara en varningssignal.`,
    };
  }
  if (stock.currentPrice > stock.sma125) {
    return {
      title: 'Positiv trend', color: 'positive', icon: '+',
      text: `Kursen (${stock.currentPrice.toFixed(2)} kr) handlas över SMA 125 (${stock.sma125.toFixed(2)} kr). Snittet fungerar som ett dynamiskt stöd vid nedgångar.`,
    };
  }
  return {
    title: 'Negativ trend', color: 'negative', icon: '-',
    text: `Kursen (${stock.currentPrice.toFixed(2)} kr) handlas under SMA 125 (${stock.sma125.toFixed(2)} kr). Snittet fungerar som ett dynamiskt motstånd tills kursen tar sig tillbaka över det.`,
  };
}
