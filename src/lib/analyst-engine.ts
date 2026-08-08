import type { StockData } from '@/types/stock';
import { assessValuation } from '@/lib/valuation';

export type AnalystVerdict = 'Positiv analys' | 'Bevaka' | 'Avvakta';

export interface DataCoverage {
  available: number;
  total: number;
  percentage: number;
  label: 'Begränsad' | 'God' | 'Mycket god';
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

export function calculateDataCoverage(stock: StockData): DataCoverage {
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
  const label: DataCoverage['label'] = percentage >= 80 ? 'Mycket god' : percentage >= 55 ? 'God' : 'Begränsad';
  return { available, total, percentage, label };
}

export function buildQuantAnalystReport(stock: StockData): AnalystReport {
  let score = 50;
  const strengths: string[] = [];
  const risks: string[] = [];
  const catalysts: string[] = [];

  if (stock.sma125 != null) {
    if (stock.currentPrice > stock.sma125) {
      score += 10;
      strengths.push('Kursen handlas över sitt 125-dagars snitt.');
    } else {
      score -= 10;
      risks.push('Kursen handlas under sitt 125-dagars snitt.');
    }
  }

  if (stock.sma200 != null) {
    if (stock.currentPrice > stock.sma200) {
      score += 8;
      strengths.push('Kursen ligger över 200-dagars snittet.');
    } else {
      score -= 8;
      risks.push('Kursen ligger under 200-dagars snittet.');
    }
  }

  if (stock.rsi != null) {
    if (stock.rsi >= 45 && stock.rsi <= 65) score += 5;
    if (stock.rsi > 72) risks.push(`RSI ${stock.rsi.toFixed(0)} indikerar ett utsträckt kortsiktigt läge.`);
    if (stock.rsi < 30) catalysts.push(`RSI ${stock.rsi.toFixed(0)} visar ett pressat läge, men bekräftar inte att kursen har vänt.`);
  }

  const valuation = assessValuation(stock);
  if (valuation.tone === 'positive') {
    score += 8;
    strengths.push(`${valuation.summary} ${valuation.evidence.join('; ')}.`);
  } else if (valuation.tone === 'negative') {
    score -= 8;
    risks.push(`${valuation.summary} ${valuation.evidence.join('; ')}.`);
  }

  if (stock.dividendYield != null && stock.dividendYield >= 0.03) {
    catalysts.push(`Uppgiven direktavkastning är ${percent(stock.dividendYield * 100)}; nästa utdelningsbeslut behöver bekräftas.`);
  }

  if (stock.volatility != null) {
    if (stock.volatility <= 25) score += 6;
    if (stock.volatility > 40) {
      score -= 8;
      risks.push(`Volatiliteten (20 handelsdagar) är hög (${percent(stock.volatility)}).`);
    }
  }

  if (stock.maxDrawdown != null && stock.maxDrawdown > 25) {
    score -= 6;
    risks.push(`Historisk max drawdown är ${percent(stock.maxDrawdown)}.`);
  }

  // Handelsplanens R-multipel ersätter den tidigare interna poängen: den mäter
  // samma sak men i en enhet som går att agera på.
  if (stock.tradePlan) {
    const { rMultiple } = stock.tradePlan;
    if (rMultiple >= 2) {
      score += 7;
      strengths.push(`Avståndet till närmaste motstånd är ${rMultiple.toFixed(1)} gånger avståndet till stoppnivån.`);
    } else if (rMultiple < 1) {
      score -= 6;
      risks.push(`Närmaste motstånd ligger närmare än stoppnivån (${rMultiple.toFixed(1)}R).`);
    }
  }

  if (stock.quality) {
    if (stock.quality.score >= 7) {
      score += 6;
      strengths.push(`Bolagets ekonomi är stark (kvalitet ${stock.quality.score.toFixed(0)} av 10).`);
    } else if (stock.quality.score < 4) {
      score -= 8;
      risks.push(`Bolagets ekonomi är svag (kvalitet ${stock.quality.score.toFixed(0)} av 10).`);
    }
  }

  const highDistance = stock.fiftyTwoWeekHigh
    ? ((stock.currentPrice - stock.fiftyTwoWeekHigh) / stock.fiftyTwoWeekHigh) * 100
    : null;
  if (highDistance != null && highDistance >= -5) {
    catalysts.push('52-veckorshögsta är en tydlig bevakningsnivå; ett eventuellt utbrott behöver följas över flera handelstillfällen.');
  }

  if (stock.signals?.some((signal) => signal.kind === 'goldenCross')) {
    score += 5;
    strengths.push('SMA 50 har nyligen korsat över SMA 200 (Golden Cross); signalen är eftersläpande.');
  }
  if (stock.signals?.some((signal) => signal.kind === 'volumeSpike')) {
    catalysts.push('Relativ volym är förhöjd. Riktningen måste bedömas tillsammans med kursrörelsen.');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const verdict: AnalystVerdict = score >= 68 ? 'Positiv analys' : score >= 45 ? 'Bevaka' : 'Avvakta';
  const dataCoverage = calculateDataCoverage(stock);
  const invalidation = stock.sma125 != null
    ? `Tesen försvagas om kursen etablerar sig under SMA 125 (${stock.sma125.toFixed(2)} kr) med fortsatt hög volatilitet.`
    : 'Tesen försvagas om trend och riskmått försämras ytterligare.';

  if (!strengths.length) strengths.push('Inga starka positiva faktorer kan fastställas från tillgänglig data.');
  if (!risks.length) risks.push('Inga enskilda högrisksignaler har identifierats i det aktuella datamaterialet.');
  if (!catalysts.length) catalysts.push('Kommande rapporter och bekräftade trendbrott är centrala observationspunkter.');

  return {
    verdict,
    dataCoverage,
    score,
    thesis: `${stock.companyName} klassificeras som ${verdict.toLowerCase()} utifrån de trend-, värderings- och riskmått som finns tillgängliga.`,
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
  return ['Positiv analys', 'Bevaka', 'Avvakta'].includes(String(report.verdict))
    && typeof report.thesis === 'string'
    && Array.isArray(report.strengths)
    && Array.isArray(report.risks)
    && Array.isArray(report.catalysts)
    && typeof report.invalidation === 'string';
}
