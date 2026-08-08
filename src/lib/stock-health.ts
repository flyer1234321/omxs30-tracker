import type { calculateBollingerBands, calculateMACD } from '@/lib/indicators';
import type { HealthCheck } from '@/types/stock';

/**
 * Sex grundkriterier ger en poäng var, och tre tekniska bonusar (mycket lågt
 * RSI, kurs vid nedre Bollingerbandet, positiv MACD-vändning) ger en till.
 * Konstanten finns för att gränssnittet ska visa rätt nämnare - tidigare stod
 * det 10 i detaljvyn och 9 i förklaringsrutan.
 */
export const MAX_GRADE_SCORE = 9;

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

  // Bonusarna beskrivs på samma form som grundkriterierna, så att gränssnittet
  // kan visa alla nio raderna och poängen går att räkna efter.
  const bonuses: HealthCheck['bonuses'] = [];

  const deeplyOversold = rsi !== null && rsi < 20;
  bonuses.push({
    label: 'Extremt översåld (RSI under 20)',
    passed: deeplyOversold,
    detail: rsi !== null ? `RSI: ${rsi.toFixed(1)}` : 'N/A',
  });
  if (deeplyOversold) gradeScore += 1;

  const atLowerBand = Boolean(bollingerBands && currentPrice <= bollingerBands.lower * 1.01);
  bonuses.push({
    label: 'Vid nedre Bollingerbandet',
    passed: atLowerBand,
    detail: bollingerBands ? `Nedre band: ${bollingerBands.lower.toFixed(2)}` : 'N/A',
  });
  if (atLowerBand) gradeScore += 1;

  const macdTurningUp = macdData?.trend === 'up';
  bonuses.push({
    label: 'Positiv momentumvändning (MACD)',
    passed: macdTurningUp,
    detail: macdData ? (macdData.trend === 'up' ? 'Stigande histogram' : macdData.trend === 'down' ? 'Fallande histogram' : 'Neutralt') : 'N/A',
  });
  if (macdTurningUp) gradeScore += 1;

  const passedItems = checklist.filter((check) => check.passed).length;
  const grade: HealthCheck['grade'] = ((gradeScore >= 7 || (passedItems >= 5 && rsi !== null && rsi < 30)) && pePassed && divPassed)
    ? 'A' : gradeScore >= 5 ? 'B' : gradeScore >= 3 ? 'C' : gradeScore >= 1 ? 'D' : 'F';
  const riskLevel: HealthCheck['riskLevel'] = volatility !== null && volatility > 40 ? 'Hög' : volatility !== null && volatility > 25 ? 'Medel' : 'Låg';
  const momentum: HealthCheck['momentum'] = macdData?.trend === 'up' ? 'Uppåt' : macdData?.trend === 'down' ? 'Nedåt' : 'Sidledes';
  const diffPct = sma125 ? Math.abs(((currentPrice - sma125) / sma125) * 100).toFixed(1) : '0.0';
  const priceAction = sma125 ? `handlas ${diffPct}% ${currentPrice < sma125 ? 'under' : 'över'} sitt 6-månaderssnitt` : 'handlas nära sitt snitt';
  const rsiText = rsi !== null && rsi < 30 ? ` och RSI ligger på ${rsi.toFixed(0)} (översåld)` : '';
  const divText = dividendYield ? `. Direktavkastningen är ${(dividendYield * 100).toFixed(1)}%` : '';
  const lowText = fiftyTwoWeekLow && ((currentPrice - fiftyTwoWeekLow) / fiftyTwoWeekLow) <= 0.10 ? `. ${(((currentPrice - fiftyTwoWeekLow) / fiftyTwoWeekLow) * 100).toFixed(1)}% från 52v-lägsta` : '';
  let summary = `${companyName} ${priceAction}${rsiText}${divText}${lowText}. Risken bedöms som ${riskLevel.toLowerCase()}.`;
  summary += grade === 'A' || grade === 'B' ? ' Övergripande visar aktien flera tecken på köpläge.' : grade === 'C' ? ' Övergripande är aktien i ett neutralt läge.' : ' Inga tydliga köpsignaler för tillfället.';

  return { grade, gradeScore, summary, riskLevel, momentum, checklist, bonuses };
}
