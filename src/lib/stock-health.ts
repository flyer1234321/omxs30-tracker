import type { calculateBollingerBands, calculateMACD } from '@/lib/indicators';
import type { HealthCheck } from '@/types/stock';

export interface HealthCheckInput {
  currentPrice: number;
  sma125: number | null;
  rsi: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyTwoWeekHigh: number | null;
  trailingPE: number | null;
  dividendYield: number | null;
  bollingerBands: ReturnType<typeof calculateBollingerBands>;
  macdData: ReturnType<typeof calculateMACD>;
  volatility: number | null;
  companyName: string;
}

export function generateHealthCheck(item: HealthCheckInput): HealthCheck {
  let gradeScore = 0;
  const checklist: HealthCheck['checklist'] = [];
  const { currentPrice, sma125, rsi, fiftyTwoWeekLow, fiftyTwoWeekHigh, trailingPE, dividendYield, bollingerBands, macdData, volatility, companyName } = item;

  const pePassed = trailingPE !== null && trailingPE > 0;
  checklist.push({ label: 'Tjänar företaget pengar?', passed: pePassed, detail: pePassed ? `P/E: ${trailingPE.toFixed(1)}` : 'Negativt/Saknas' });
  if (pePassed) gradeScore += 1;

  const divPassed = dividendYield !== null && dividendYield > 0;
  checklist.push({ label: 'Betalar utdelning?', passed: divPassed, detail: divPassed ? `Direktavkastning: ${(dividendYield * 100).toFixed(1)}%` : 'Ingen utdelning' });
  if (divPassed) gradeScore += 1;

  const dropVal = fiftyTwoWeekHigh
    ? ((fiftyTwoWeekHigh - currentPrice) / fiftyTwoWeekHigh) * 100
    : sma125 ? ((sma125 - currentPrice) / sma125) * 100 : 0;
  const dropPassed = dropVal > 8;
  checklist.push({ label: 'Har aktien fallit kraftigt?', passed: dropPassed, detail: `Faller ${dropVal.toFixed(1)}%` });
  if (dropPassed) gradeScore += 1;

  const nearLowPassed = fiftyTwoWeekLow ? ((currentPrice - fiftyTwoWeekLow) / fiftyTwoWeekLow) <= 0.10 : false;
  checklist.push({ label: 'Nära botten?', passed: nearLowPassed, detail: fiftyTwoWeekLow ? `${(((currentPrice - fiftyTwoWeekLow) / fiftyTwoWeekLow) * 100).toFixed(1)}% från botten` : 'N/A' });
  if (nearLowPassed) gradeScore += 1;

  const rsiPassed = rsi !== null && rsi < 35;
  checklist.push({ label: 'Översåld (RSI)?', passed: rsiPassed, detail: rsi ? `RSI: ${rsi.toFixed(1)}` : 'N/A' });
  if (rsiPassed) gradeScore += 1;

  const smaPassed = sma125 !== null && currentPrice < sma125;
  const smaDiff = sma125 ? ((sma125 - currentPrice) / sma125) * 100 : 0;
  checklist.push({ label: 'Under glidande medelvärde?', passed: smaPassed, detail: smaPassed ? `${smaDiff.toFixed(1)}% under` : 'Över SMA' });
  if (smaPassed) gradeScore += 1;

  if (rsi !== null && rsi < 20) gradeScore += 1;
  if (bollingerBands && currentPrice <= bollingerBands.lower * 1.01) gradeScore += 1;
  if (macdData?.trend === 'up') gradeScore += 1;

  const passedItems = checklist.filter((check) => check.passed).length;
  const grade: HealthCheck['grade'] = ((gradeScore >= 7 || (passedItems >= 5 && rsi !== null && rsi < 30)) && pePassed && divPassed)
    ? 'A' : gradeScore >= 5 ? 'B' : gradeScore >= 3 ? 'C' : gradeScore >= 1 ? 'D' : 'F';
  const riskLevel: HealthCheck['riskLevel'] = volatility !== null && volatility > 40 ? 'Hög' : volatility !== null && volatility > 25 ? 'Medel' : 'Låg';
  const momentum: HealthCheck['momentum'] = macdData?.trend === 'up' ? 'Uppåt' : macdData?.trend === 'down' ? 'Nedåt' : 'Sidledes';
  const diffPct = sma125 ? Math.abs(((currentPrice - sma125) / sma125) * 100).toFixed(1) : '0.0';
  const priceAction = sma125 ? `${currentPrice < sma125 ? 'handlas' : 'handlas'} ${diffPct}% ${currentPrice < sma125 ? 'under' : 'över'} sitt 6-månaderssnitt` : 'handlas nära sitt snitt';
  const rsiText = rsi !== null && rsi < 30 ? ` och RSI ligger på ${rsi.toFixed(0)} (översåld)` : '';
  const divText = dividendYield ? `. Direktavkastningen är ${(dividendYield * 100).toFixed(1)}%` : '';
  const lowText = fiftyTwoWeekLow && ((currentPrice - fiftyTwoWeekLow) / fiftyTwoWeekLow) <= 0.10 ? `. ${(((currentPrice - fiftyTwoWeekLow) / fiftyTwoWeekLow) * 100).toFixed(1)}% från 52v-lägsta` : '';
  let summary = `${companyName} ${priceAction}${rsiText}${divText}${lowText}. Risken bedöms som ${riskLevel.toLowerCase()}.`;
  summary += grade === 'A' || grade === 'B' ? ' Övergripande visar aktien flera tecken på köpläge.' : grade === 'C' ? ' Övergripande är aktien i ett neutralt läge.' : ' Inga tydliga köpsignaler för tillfället.';

  return { grade, gradeScore, summary, riskLevel, momentum, checklist };
}
