import type { StockData } from '@/types/stock';

export type AnalystVerdict = 'Positiv analys' | 'Bevaka' | 'Avvakta';
export type AnalystConfidence = 'Låg' | 'Medel' | 'Hög';

export interface AnalystReport {
  verdict: AnalystVerdict;
  confidence: AnalystConfidence;
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

export function buildQuantAnalystReport(stock: StockData): AnalystReport {
  let score = 50;
  let observedSignals = 0;
  const strengths: string[] = [];
  const risks: string[] = [];
  const catalysts: string[] = [];

  if (stock.sma125 != null) {
    observedSignals += 1;
    if (stock.currentPrice > stock.sma125) {
      score += 10;
      strengths.push('Kursen handlas över sitt 125-dagars snitt.');
    } else {
      score -= 10;
      risks.push('Kursen handlas under sitt 125-dagars snitt.');
    }
  }

  if (stock.sma200 != null) {
    observedSignals += 1;
    if (stock.currentPrice > stock.sma200) {
      score += 8;
      strengths.push('Kursen ligger över 200-dagars snittet.');
    } else {
      score -= 8;
      risks.push('Kursen ligger under 200-dagars snittet.');
    }
  }

  if (stock.rsi != null) {
    observedSignals += 1;
    if (stock.rsi >= 45 && stock.rsi <= 65) score += 5;
    if (stock.rsi > 72) risks.push(`RSI ${stock.rsi.toFixed(0)} indikerar ett utsträckt kortsiktigt läge.`);
    if (stock.rsi < 30) catalysts.push(`RSI ${stock.rsi.toFixed(0)} ger möjlighet till en teknisk rekyl.`);
  }

  if (stock.trailingPE != null && stock.trailingPE > 0) {
    observedSignals += 1;
    if (stock.trailingPE <= 18) {
      score += 8;
      strengths.push(`Värderingen är måttlig med P/E ${stock.trailingPE.toFixed(1)}.`);
    } else if (stock.trailingPE >= 30) {
      score -= 8;
      risks.push(`Värderingen är krävande med P/E ${stock.trailingPE.toFixed(1)}.`);
    }
  }

  if (stock.dividendYield != null && stock.dividendYield >= 0.03) {
    observedSignals += 1;
    score += 4;
    strengths.push(`Direktavkastningen är ${percent(stock.dividendYield * 100)}.`);
  }

  if (stock.volatility != null) {
    observedSignals += 1;
    if (stock.volatility <= 25) score += 6;
    if (stock.volatility > 40) {
      score -= 8;
      risks.push(`Volatiliteten (20 handelsdagar) är hög (${percent(stock.volatility)}).`);
    }
  }

  if (stock.maxDrawdown != null && stock.maxDrawdown > 25) {
    observedSignals += 1;
    score -= 6;
    risks.push(`Historisk max drawdown är ${percent(stock.maxDrawdown)}.`);
  }

  // Handelsplanens R-multipel ersätter den tidigare interna poängen: den mäter
  // samma sak men i en enhet som går att agera på.
  if (stock.tradePlan) {
    observedSignals += 1;
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
    observedSignals += 1;
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
    observedSignals += 1;
    catalysts.push('Ett utbrott över 52-veckorshögsta kan bekräfta fortsatt styrka.');
  }

  if (stock.signals?.some((signal) => signal.kind === 'goldenCross')) {
    score += 5;
    strengths.push('Golden Cross är aktivt i den tekniska signalmodellen.');
  }
  if (stock.signals?.some((signal) => signal.kind === 'volumeSpike')) {
    catalysts.push('Förhöjd relativ volym kan bekräfta ett kursutbrott.');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const verdict: AnalystVerdict = score >= 68 ? 'Positiv analys' : score >= 45 ? 'Bevaka' : 'Avvakta';
  const confidence: AnalystConfidence = observedSignals >= 7 ? 'Hög' : observedSignals >= 4 ? 'Medel' : 'Låg';
  const invalidation = stock.sma125 != null
    ? `Tesen försvagas om kursen etablerar sig under SMA 125 (${stock.sma125.toFixed(2)} kr) med fortsatt hög volatilitet.`
    : 'Tesen försvagas om trend och riskmått försämras ytterligare.';

  if (!strengths.length) strengths.push('Inga starka positiva faktorer kan fastställas från tillgänglig data.');
  if (!risks.length) risks.push('Inga enskilda högrisksignaler har identifierats i det aktuella datamaterialet.');
  if (!catalysts.length) catalysts.push('Kommande rapporter och bekräftade trendbrott är centrala observationspunkter.');

  return {
    verdict,
    confidence,
    score,
    thesis: `${stock.companyName} klassificeras som ${verdict.toLowerCase()} baserat på nuvarande trend, värdering och riskmått.`,
    strengths: strengths.slice(0, 3),
    risks: risks.slice(0, 3),
    catalysts: catalysts.slice(0, 2),
    invalidation,
    source: 'quant',
    generatedAt: new Date().toISOString(),
  };
}

export function isAnalystReport(value: unknown): value is Omit<AnalystReport, 'source' | 'generatedAt' | 'score'> {
  if (!value || typeof value !== 'object') return false;
  const report = value as Record<string, unknown>;
  return ['Positiv analys', 'Bevaka', 'Avvakta'].includes(String(report.verdict))
    && ['Låg', 'Medel', 'Hög'].includes(String(report.confidence))
    && typeof report.thesis === 'string'
    && Array.isArray(report.strengths)
    && Array.isArray(report.risks)
    && Array.isArray(report.catalysts)
    && typeof report.invalidation === 'string';
}
