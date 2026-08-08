import { MAX_GRADE_SCORE } from '@/lib/stock-health';
import { daysUntilEarnings } from '@/lib/stock-signals';
import type { StockData } from '@/types/stock';
import type { AppLanguage } from '@/lib/language';

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
  /** Vad kombinationen av kursfall och bolagsekonomi säger. */
  qualityVerdict: string | null;
  ifYouOwn: string;
  ifYouConsiderBuying: string;
}

export function interpretHealth(stock: StockData, now = Date.now(), language: AppLanguage = 'sv'): HealthInterpretation | null {
  const health = stock.healthCheck;
  if (!health) return null;

  const basePassed = health.checklist.filter((item) => item.passed).length;
  const bonusPassed = health.bonuses.filter((item) => item.passed).length;
  const belowLongTrend = stock.sma125 != null && stock.currentPrice < stock.sma125;
  const belowYearTrend = stock.sma200 != null && stock.currentPrice < stock.sma200;
  const earningsDays = daysUntilEarnings(stock.earningsTimestamp, now);
  const earningsImminent = earningsDays != null && earningsDays >= 0 && earningsDays <= 7;

  const scoreExplanation = buildScoreExplanation(health.gradeScore, basePassed, health.checklist.length, bonusPassed, health.bonuses.length, language);
  const qualityVerdict = buildQualityVerdict(stock, belowLongTrend, language);

  return {
    scoreExplanation,
    qualityVerdict,
    ifYouOwn: buildOwnerText(stock, belowLongTrend, belowYearTrend, earningsImminent, earningsDays, language),
    ifYouConsiderBuying: buildBuyerText(stock, belowLongTrend, earningsImminent, earningsDays, language),
  };
}

/**
 * Kombinationen av de två måtten säger mer än något av dem för sig. Ett stort
 * fall i ett välskött bolag och ett stort fall i ett bolag som förbrukar kassa
 * ser identiska ut i kursgrafen, och det är skillnaden mellan ett tillfälle och
 * en värdefälla.
 */
function buildQualityVerdict(stock: StockData, belowLongTrend: boolean, language: AppLanguage): string | null {
  const quality = stock.quality;
  const grade = stock.healthCheck?.grade;
  if (!quality) return null;

  const fallenHard = belowLongTrend && (grade === 'A' || grade === 'B');

  if (fallenHard && quality.score < 4) {
    return language === 'en'
      ? `The share has fallen sharply while company fundamentals look weak (quality ${quality.score.toFixed(0)} out of 10). This is the combination that makes pullback models risky: criteria keep triggering on the way down even when the decline is justified. Find out why the figures look this way before treating the decline as an opportunity.`
      : `Kursen har fallit mycket samtidigt som bolagets ekonomi ser svag ut (kvalitet ${quality.score.toFixed(0)} av 10). Det är den kombination som gör rekylmodeller farliga: kriterierna slår in hela vägen ned, även när nedgången är befogad. Ta reda på varför siffrorna ser ut som de gör innan du tolkar fallet som ett tillfälle.`;
  }

  if (fallenHard && quality.score >= 7) {
    return language === 'en'
      ? `The share has fallen sharply, but company fundamentals look strong (quality ${quality.score.toFixed(0)} out of 10). This is the more interesting kind of pullback: the market has repriced the share while reported fundamentals have not yet changed. The question is whether the market knows something that is not yet visible in the figures.`
      : `Kursen har fallit mycket, men bolagets ekonomi ser stark ut (kvalitet ${quality.score.toFixed(0)} av 10). Det är den mer intressanta varianten av ett rekylläge: marknaden har omprövat priset utan att räkenskaperna hittills ändrats. Frågan är om marknaden vet något som ännu inte syns i siffrorna.`;
  }

  if (quality.score < 4) {
    return language === 'en'
      ? `Company fundamentals look weak (quality ${quality.score.toFixed(0)} out of 10), regardless of the price move. Weak finances reduce flexibility when conditions deteriorate.`
      : `Bolagets ekonomi ser svag ut (kvalitet ${quality.score.toFixed(0)} av 10), oavsett vad kursen gjort. Svaga finanser begränsar handlingsutrymmet när något går emot.`;
  }

  return language === 'en'
    ? `Quality ${quality.score.toFixed(0)} out of 10 based on leverage, profitability, margin, cash flow and growth.`
    : `Kvalitet ${quality.score.toFixed(0)} av 10 utifrån skuldsättning, lönsamhet, marginal, kassaflöde och tillväxt.`;
}

function buildScoreExplanation(score: number, basePassed: number, baseTotal: number, bonusPassed: number, bonusTotal: number, language: AppLanguage) {
  if (language === 'en') {
    const parts = [`${score} out of ${MAX_GRADE_SCORE} points: ${basePassed} of ${baseTotal} core criteria and ${bonusPassed} of ${bonusTotal} technical bonuses.`];
    if (score >= 5) parts.push('The scale measures decline, not quality. Four of the six criteria reward a falling price: a large drop from the high, proximity to the annual low, low RSI and price below its average. A high score therefore mainly means that the share has fallen substantially, not that the company is good.');
    else if (score <= 2) parts.push('A low score usually means the share has not fallen enough for the model to react. This is consistent both with a strong uptrend and with an average share moving sideways.');
    else parts.push('The middle of the scale says the least. The model looks for clear pullbacks, and this is not one.');
    return parts.join(' ');
  }
  const parts = [
    `${score} av ${MAX_GRADE_SCORE} poäng: ${basePassed} av ${baseTotal} grundkriterier och ${bonusPassed} av ${bonusTotal} tekniska bonusar.`,
  ];

  // Den vanligaste missuppfattningen: att en hög poäng betyder ett bra bolag.
  if (score >= 5) {
    parts.push('Skalan mäter fall, inte kvalitet. Fyra av de sex kriterierna belönar att kursen gått ned: stort fall från toppen, nära årslägsta, lågt RSI och kurs under snittet. En hög poäng betyder därför främst att aktien gått ned mycket, inte att bolaget är bra.');
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
  language: AppLanguage,
) {
  const parts: string[] = [];

  if (language === 'en') {
    if (belowLongTrend && belowYearTrend) parts.push('The price is below both its six-month and one-year averages. This is a downtrend, and the model’s pullback criteria do not indicate when it will end.');
    else if (belowLongTrend) parts.push('The price has broken below its six-month average but remains above its one-year average. This is often where a pullback and a trend reversal look alike.');
    else parts.push('The price is above its six-month average, indicating an intact uptrend.');
    if (stock.rsi != null && stock.rsi > 70) parts.push(`RSI at ${stock.rsi.toFixed(0)} indicates a steep rise. Historically, such conditions have more often been followed by a pause than continued acceleration.`);
    if (stock.tradePlan) parts.push(`A decline to the stop level at ${stock.tradePlan.stopLoss.toFixed(2)} equals ${stock.tradePlan.riskPercent.toFixed(1)}% from here. A useful question is whether you would buy the share today at the current price. If the answer is no, that is equivalent to wanting to sell.`);
    if (earningsImminent) parts.push(`Earnings are due in ${earningsDays} ${earningsDays === 1 ? 'day' : 'days'}. Until then, the content of that report matters more than any technical level on this page.`);
    return parts.join(' ');
  }

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
  language: AppLanguage,
) {
  const parts: string[] = [];

  if (language === 'en') {
    if (earningsImminent) parts.push(`The company reports in ${earningsDays} ${earningsDays === 1 ? 'day' : 'days'}. Buying before earnings is a bet on the report, not on the information shown here.`);
    const grade = stock.healthCheck?.grade;
    if ((grade === 'A' || grade === 'B') && belowLongTrend) parts.push('The share meets several pullback criteria. This confirms that the decline has been large, not that it is over. The key question is why the price has fallen, which the model cannot answer.');
    else if (!belowLongTrend) parts.push('The share is not a pullback case according to the model. That does not rule out a purchase, but the decision would need to rest on trend strength and company development rather than this score.');
    if (stock.tradePlan) {
      const plan = stock.tradePlan;
      if (plan.rMultiple >= 2) parts.push(`The distance to the nearest resistance is ${plan.rMultiple.toFixed(1)} times the distance to the stop. This allows the strategy to be wrong more often than right and still remain profitable.`);
      else if (plan.rMultiple < 1) parts.push(`The nearest resistance is closer than the stop, at ${plan.rMultiple.toFixed(1)} times the risk. You need to be right more often than wrong for the trade to pay off.`);
    }
    if (stock.volatility != null && stock.volatility > 40) parts.push(`Volatility at ${stock.volatility.toFixed(0)}% means a position should be smaller than in a calmer share to keep the monetary risk equal.`);
    if (!parts.length) parts.push('Nothing in the available data stands out clearly. The model sees neither a distinct pullback nor a clear warning.');
    return parts.join(' ');
  }

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
