import type { StockData } from '@/types/stock';
import { assessValuation } from '@/lib/valuation';
import type { AppLanguage } from '@/lib/language';

export type AnalystVerdict = 'Positiv analys' | 'Bevaka' | 'Avvakta' | 'Positive' | 'Watch' | 'Wait';

export interface DataCoverage {
  available: number;
  total: number;
  percentage: number;
  label: 'Begränsad' | 'God' | 'Mycket god' | 'Limited' | 'Good' | 'Very good';
}

export interface AnalystReport {
  verdict: AnalystVerdict;
  dataCoverage: DataCoverage;
  score: number;
  thesis: string;
  strengths: string[];
  risks: string[];
  catalysts: string[];
  invalidation: string;
  source: 'quant' | 'ai';
  generatedAt: string;
}

function percent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function calculateDataCoverage(stock: StockData, language: AppLanguage = 'sv'): DataCoverage {
  const available = [
    stock.sma125,
    stock.sma200,
    stock.rsi,
    stock.trailingPE,
    stock.valuation?.trailingPEProxyMedian,
    stock.valuation?.trailingPESectorMedian,
    stock.volatility,
    stock.maxDrawdown,
    stock.beta,
    stock.quality,
    stock.tradePlan,
    stock.latestVolume != null && stock.avgVolume20 != null ? true : null,
    stock.macdData,
    stock.atr,
    stock.relativeStrength63,
    stock.earningsTimestamp,
    stock.priceToBook,
    stock.chartHistory.length >= 20 ? true : null,
  ].filter((value) => value != null).length;
  const total = 18;
  const percentage = Math.round((available / total) * 100);
  const label: DataCoverage['label'] = language === 'en'
    ? percentage >= 80 ? 'Very good' : percentage >= 55 ? 'Good' : 'Limited'
    : percentage >= 80 ? 'Mycket god' : percentage >= 55 ? 'God' : 'Begränsad';
  return { available, total, percentage, label };
}

export function buildQuantAnalystReport(stock: StockData, language: AppLanguage = 'sv'): AnalystReport {
  const en = language === 'en';
  const t = (sv: string, english: string) => en ? english : sv;
  let score = 50;
  const strengths: string[] = [];
  const risks: string[] = [];
  const catalysts: string[] = [];

  if (stock.sma125 != null) {
    if (stock.currentPrice > stock.sma125) {
      score += 10;
      strengths.push(t('Kursen handlas över sitt 125-dagars snitt.', 'The share trades above its 125-day moving average.'));
    } else {
      score -= 10;
      risks.push(t('Kursen handlas under sitt 125-dagars snitt.', 'The share trades below its 125-day moving average.'));
    }
  }

  if (stock.sma200 != null) {
    if (stock.currentPrice > stock.sma200) {
      score += 8;
      strengths.push(t('Kursen ligger över 200-dagars snittet.', 'The share trades above its 200-day moving average.'));
    } else {
      score -= 8;
      risks.push(t('Kursen ligger under 200-dagars snittet.', 'The share trades below its 200-day moving average.'));
    }
  }

  if (stock.rsi != null) {
    if (stock.rsi >= 45 && stock.rsi <= 65) score += 5;
    if (stock.rsi > 72) risks.push(t(`RSI ${stock.rsi.toFixed(0)} indikerar ett utsträckt kortsiktigt läge.`, `RSI ${stock.rsi.toFixed(0)} indicates stretched short-term momentum.`));
    if (stock.rsi < 30) catalysts.push(t(`RSI ${stock.rsi.toFixed(0)} visar ett pressat läge, men bekräftar inte att kursen har vänt.`, `RSI ${stock.rsi.toFixed(0)} indicates an oversold condition, but does not confirm a reversal.`));
  }

  const valuation = assessValuation(stock, language);
  if (valuation.tone === 'positive') {
    score += 8;
    strengths.push(en ? 'Relative valuation is favourable compared with at least one available reference.' : `${valuation.summary} ${valuation.evidence.join('; ')}.`);
  } else if (valuation.tone === 'negative') {
    score -= 8;
    risks.push(en ? 'Relative valuation is elevated compared with at least one available reference.' : `${valuation.summary} ${valuation.evidence.join('; ')}.`);
  }

  if (stock.dividendYield != null && stock.dividendYield >= 0.03) {
    catalysts.push(t(`Uppgiven direktavkastning är ${percent(stock.dividendYield * 100)}; nästa utdelningsbeslut behöver bekräftas.`, `The indicated dividend yield is ${percent(stock.dividendYield * 100)}; the next dividend decision still needs confirmation.`));
  }

  if (stock.volatility != null) {
    if (stock.volatility <= 25) score += 6;
    if (stock.volatility > 40) {
      score -= 8;
      risks.push(t(`Volatiliteten (20 handelsdagar) är hög (${percent(stock.volatility)}).`, `Twenty-day volatility is high (${percent(stock.volatility)}).`));
    }
  }

  if (stock.maxDrawdown != null && stock.maxDrawdown > 25) {
    score -= 6;
    risks.push(t(`Historisk max drawdown är ${percent(stock.maxDrawdown)}.`, `Historical maximum drawdown is ${percent(stock.maxDrawdown)}.`));
  }

  // Handelsplanens R-multipel ersätter den tidigare interna poängen: den mäter
  // samma sak men i en enhet som går att agera på.
  if (stock.tradePlan) {
    const { rMultiple } = stock.tradePlan;
    if (rMultiple >= 2) {
      score += 7;
      strengths.push(t(`Avståndet till närmaste motstånd är ${rMultiple.toFixed(1)} gånger avståndet till stoppnivån.`, `The distance to the nearest resistance is ${rMultiple.toFixed(1)} times the distance to the stop level.`));
    } else if (rMultiple < 1) {
      score -= 6;
      risks.push(t(`Närmaste motstånd ligger närmare än stoppnivån (${rMultiple.toFixed(1)}R).`, `The nearest resistance is closer than the stop level (${rMultiple.toFixed(1)}R).`));
    }
  }

  if (stock.quality) {
    if (stock.quality.score >= 7) {
      score += 6;
      strengths.push(t(`Bolagets ekonomi är stark (kvalitet ${stock.quality.score.toFixed(0)} av 10).`, `Company fundamentals are strong (quality ${stock.quality.score.toFixed(0)} out of 10).`));
    } else if (stock.quality.score < 4) {
      score -= 8;
      risks.push(t(`Bolagets ekonomi är svag (kvalitet ${stock.quality.score.toFixed(0)} av 10).`, `Company fundamentals are weak (quality ${stock.quality.score.toFixed(0)} out of 10).`));
    }
  }

  const highDistance = stock.fiftyTwoWeekHigh
    ? ((stock.currentPrice - stock.fiftyTwoWeekHigh) / stock.fiftyTwoWeekHigh) * 100
    : null;
  if (highDistance != null && highDistance >= -5) {
    catalysts.push(t('52-veckorshögsta är en tydlig bevakningsnivå; ett eventuellt utbrott behöver följas över flera handelstillfällen.', 'The 52-week high is a clear level to watch; a possible breakout needs confirmation across several sessions.'));
  }

  if (stock.signals?.some((signal) => signal.kind === 'goldenCross')) {
    score += 5;
    strengths.push(t('SMA 50 har nyligen korsat över SMA 200 (Golden Cross); signalen är eftersläpande.', 'SMA 50 recently crossed above SMA 200 (Golden Cross); the signal is lagging.'));
  }
  if (stock.signals?.some((signal) => signal.kind === 'volumeSpike')) {
    catalysts.push(t('Relativ volym är förhöjd. Riktningen måste bedömas tillsammans med kursrörelsen.', 'Relative volume is elevated. Direction must be assessed together with the price move.'));
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const verdict: AnalystVerdict = en
    ? score >= 68 ? 'Positive' : score >= 45 ? 'Watch' : 'Wait'
    : score >= 68 ? 'Positiv analys' : score >= 45 ? 'Bevaka' : 'Avvakta';
  const dataCoverage = calculateDataCoverage(stock, language);
  const invalidation = stock.sma125 != null
    ? t(`Tesen försvagas om kursen etablerar sig under SMA 125 (${stock.sma125.toFixed(2)} kr) med fortsatt hög volatilitet.`, `The thesis weakens if the share establishes itself below SMA 125 (${stock.sma125.toFixed(2)} kr) while volatility remains high.`)
    : t('Tesen försvagas om trend och riskmått försämras ytterligare.', 'The thesis weakens if trend and risk metrics deteriorate further.');

  if (!strengths.length) strengths.push(t('Inga starka positiva faktorer kan fastställas från tillgänglig data.', 'No strong positive factors can be established from the available data.'));
  if (!risks.length) risks.push(t('Inga enskilda högrisksignaler har identifierats i det aktuella datamaterialet.', 'No single high-risk signal has been identified in the current data.'));
  if (!catalysts.length) catalysts.push(t('Kommande rapporter och bekräftade trendbrott är centrala observationspunkter.', 'Upcoming reports and confirmed trend changes are key points to monitor.'));

  return {
    verdict,
    dataCoverage,
    score,
    thesis: en
      ? `${stock.companyName} is classified as ${verdict.toLowerCase()} based on the available trend, valuation and risk metrics.`
      : `${stock.companyName} klassificeras som ${verdict.toLowerCase()} utifrån de trend-, värderings- och riskmått som finns tillgängliga.`,
    strengths: strengths.slice(0, 3),
    risks: risks.slice(0, 3),
    catalysts: catalysts.slice(0, 2),
    invalidation,
    source: 'quant',
    generatedAt: new Date().toISOString(),
  };
}

export function isAnalystReport(value: unknown): value is Omit<AnalystReport, 'source' | 'generatedAt' | 'score' | 'dataCoverage'> {
  if (!value || typeof value !== 'object') return false;
  const report = value as Record<string, unknown>;
  return ['Positiv analys', 'Bevaka', 'Avvakta', 'Positive', 'Watch', 'Wait'].includes(String(report.verdict))
    && typeof report.thesis === 'string'
    && Array.isArray(report.strengths)
    && Array.isArray(report.risks)
    && Array.isArray(report.catalysts)
    && typeof report.invalidation === 'string';
}
