import { MAX_GRADE_SCORE } from '@/lib/stock-health';
import { daysUntilEarnings } from '@/lib/stock-signals';
import type { StockData } from '@/types/stock';

/**
 * Översätter hälsopoängen till vad den faktiskt innebär.
 *
 * Ett tal som "5 av 9" är obegripligt utan tre saker: vad poängen består av,
 * vad den betyder om man redan äger aktien, och vad den betyder om man
 * överväger att köpa. De två sista är olika frågor med olika svar, och
 * appen besvarade tidigare ingen av dem.
 *
 * Texterna beskriver läget och pekar på vad som är värt att väga in. De ger
 * inga rekommendationer: modellen känner varken till bolagets verksamhet,
 * din tidshorisont eller resten av din portfölj.
 */

export interface HealthInterpretation {
  scoreExplanation: string;
  ifYouOwn: string;
  ifYouConsiderBuying: string;
}

export function interpretHealth(stock: StockData, now = Date.now()): HealthInterpretation | null {
  const health = stock.healthCheck;
  if (!health) return null;

  const basePassed = health.checklist.filter((item) => item.passed).length;
  const bonusPassed = health.bonuses.filter((item) => item.passed).length;
  const belowLongTrend = stock.sma125 != null && stock.currentPrice < stock.sma125;
  const belowYearTrend = stock.sma200 != null && stock.currentPrice < stock.sma200;
  const earningsDays = daysUntilEarnings(stock.earningsTimestamp, now);
  const earningsImminent = earningsDays != null && earningsDays >= 0 && earningsDays <= 7;

  const scoreExplanation = buildScoreExplanation(health.gradeScore, basePassed, health.checklist.length, bonusPassed, health.bonuses.length);

  return {
    scoreExplanation,
    ifYouOwn: buildOwnerText(stock, belowLongTrend, belowYearTrend, earningsImminent, earningsDays),
    ifYouConsiderBuying: buildBuyerText(stock, belowLongTrend, earningsImminent, earningsDays),
  };
}

function buildScoreExplanation(score: number, basePassed: number, baseTotal: number, bonusPassed: number, bonusTotal: number) {
  const parts = [
    `${score} av ${MAX_GRADE_SCORE} poäng: ${basePassed} av ${baseTotal} grundkriterier och ${bonusPassed} av ${bonusTotal} tekniska bonusar.`,
  ];

  // Den vanligaste missuppfattningen: att en hög poäng betyder ett bra bolag.
  if (score >= 5) {
    parts.push('Kom ihåg vad kriterierna mäter. Fyra av de sex belönar att kursen fallit: stort fall från toppen, nära årslägsta, lågt RSI och kurs under snittet. En hög poäng betyder därför främst att aktien gått ned mycket, inte att bolaget är bra.');
  } else if (score <= 2) {
    parts.push('Låg poäng betyder oftast att aktien inte fallit tillräckligt för att modellen ska reagera. Det är lika förenligt med en stark aktie i uppåttrend som med en medioker aktie som står stilla.');
  } else {
    parts.push('Mitten av skalan säger minst av allt. Modellen letar efter tydliga rekyllägen, och det här är inget sådant.');
  }

  return parts.join(' ');
}

function buildOwnerText(
  stock: StockData,
  belowLongTrend: boolean,
  belowYearTrend: boolean,
  earningsImminent: boolean,
  earningsDays: number | null,
) {
  const parts: string[] = [];

  if (belowLongTrend && belowYearTrend) {
    parts.push('Kursen ligger under både halvårs- och årssnittet. Det är en fallande trend, och modellens rekylkriterier säger ingenting om när den tar slut.');
  } else if (belowLongTrend) {
    parts.push('Kursen har brutit ned genom halvårssnittet men håller sig över årssnittet. Det brukar vara det läge där en rekyl och en trendvändning ser likadana ut.');
  } else {
    parts.push('Kursen ligger över sitt halvårssnitt, alltså i en fungerande uppåttrend.');
  }

  if (stock.rsi != null && stock.rsi > 70) {
    parts.push(`RSI på ${stock.rsi.toFixed(0)} betyder att uppgången varit brant. Historiskt har den typen av lägen oftare följts av en paus än av en fortsatt rusning.`);
  }

  if (stock.tradePlan) {
    parts.push(`Fallet till stoppnivån ${stock.tradePlan.stopLoss.toFixed(2)} motsvarar ${stock.tradePlan.riskPercent.toFixed(1)} % härifrån. Frågan värd att ställa är om du skulle köpa aktien i dag till dagens kurs. Är svaret nej är det samma sak som att vilja sälja.`);
  }

  if (earningsImminent) {
    parts.push(`Rapport om ${earningsDays} ${earningsDays === 1 ? 'dag' : 'dagar'}. Fram till dess väger innehållet i den tyngre än alla tekniska nivåer på den här sidan.`);
  }

  return parts.join(' ');
}

function buildBuyerText(
  stock: StockData,
  belowLongTrend: boolean,
  earningsImminent: boolean,
  earningsDays: number | null,
) {
  const parts: string[] = [];

  if (earningsImminent) {
    parts.push(`Bolaget rapporterar om ${earningsDays} ${earningsDays === 1 ? 'dag' : 'dagar'}. Att köpa före en rapport är att satsa på innehållet i den, inte på det som står här.`);
  }

  const grade = stock.healthCheck?.grade;
  if ((grade === 'A' || grade === 'B') && belowLongTrend) {
    parts.push('Aktien uppfyller flera rekylkriterier. Det bekräftar att fallet varit stort, inte att det är över. Den avgörande frågan är varför kursen fallit, och den kan modellen inte svara på.');
  } else if (!belowLongTrend) {
    parts.push('Aktien är inget rekylcase enligt modellen. Det utesluter inte ett köp, men då är det trendens styrka och bolagets utveckling som får bära beslutet, inte den här poängen.');
  }

  if (stock.tradePlan) {
    const plan = stock.tradePlan;
    if (plan.rMultiple >= 2) {
      parts.push(`Avståndet till närmaste motstånd är ${plan.rMultiple.toFixed(1)} gånger avståndet till stoppen. Det är ett läge där man kan ha fel oftare än man har rätt och ändå gå plus.`);
    } else if (plan.rMultiple < 1) {
      parts.push(`Närmaste motstånd ligger närmare än stoppen, alltså ${plan.rMultiple.toFixed(1)} gånger risken. Du behöver ha rätt oftare än du har fel för att det ska löna sig.`);
    }
  }

  if (stock.volatility != null && stock.volatility > 40) {
    parts.push(`Volatiliteten på ${stock.volatility.toFixed(0)} % innebär att en position bör vara mindre än i en lugnare aktie för att risken i kronor ska bli densamma.`);
  }

  if (!parts.length) {
    parts.push('Inget i den tillgängliga datan sticker ut åt något håll. Modellen ser varken ett tydligt rekylläge eller en tydlig varning.');
  }

  return parts.join(' ');
}
