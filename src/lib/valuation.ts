import type { StockData } from '@/types/stock';

export type ValuationTone = 'positive' | 'neutral' | 'negative' | 'unknown';

export interface ValuationAssessment {
  label: string;
  tone: ValuationTone;
  summary: string;
  evidence: string[];
  availableComparisons: number;
  totalComparisons: 2;
}

function relativeDifference(value: number, reference: number) {
  return ((value / reference) - 1) * 100;
}

function comparisonText(prefix: string, difference: number) {
  const magnitude = Math.abs(difference).toFixed(0);
  if (difference <= -5) return `${magnitude} % under ${prefix}`;
  if (difference >= 5) return `${magnitude} % över ${prefix}`;
  return `i linje med ${prefix}`;
}

/**
 * Bedömer bara relativ värdering. Ett P/E blir aldrig kallat billigt eller dyrt
 * enbart för att det passerar en generell gräns.
 */
export function assessValuation(stock: Pick<StockData, 'trailingPE' | 'valuation' | 'sector'>): ValuationAssessment {
  const pe = stock.trailingPE;
  if (pe == null || pe <= 0) {
    return {
      label: 'Otillräckligt underlag',
      tone: 'unknown',
      summary: 'Positiv vinst och jämförbar P/E-data saknas.',
      evidence: [],
      availableComparisons: 0,
      totalComparisons: 2,
    };
  }

  const comparisons: { difference: number; text: string }[] = [];
  const ownMedian = stock.valuation?.trailingPEProxyMedian;
  if (ownMedian != null && ownMedian > 0) {
    const difference = relativeDifference(pe, ownMedian);
    comparisons.push({ difference, text: comparisonText('12-månadersproxy med dagens VPA', difference) });
  }

  const sectorMedian = stock.valuation?.trailingPESectorMedian;
  const sectorSampleSize = stock.valuation?.sectorSampleSize ?? 0;
  if (sectorMedian != null && sectorMedian > 0 && sectorSampleSize >= 3) {
    const difference = relativeDifference(pe, sectorMedian);
    const sectorLabel = stock.sector ? `sektorn ${stock.sector}` : 'sektorns median';
    comparisons.push({ difference, text: `${comparisonText(sectorLabel, difference)} (${sectorSampleSize} bolag)` });
  }

  if (!comparisons.length) {
    return {
      label: 'Otillräckligt underlag',
      tone: 'unknown',
      summary: `P/E är ${pe.toFixed(1)}, men relevanta jämförelser saknas.`,
      evidence: [],
      availableComparisons: 0,
      totalComparisons: 2,
    };
  }

  const lower = comparisons.filter(({ difference }) => difference <= -15).length;
  const higher = comparisons.filter(({ difference }) => difference >= 15).length;
  const evidence = comparisons.map(({ text }) => text);

  if (lower > 0 && higher > 0) {
    return {
      label: 'Blandad jämförelse',
      tone: 'neutral',
      summary: `P/E ${pe.toFixed(1)} ger olika besked mot prisproxy och sektor.`,
      evidence,
      availableComparisons: comparisons.length,
      totalComparisons: 2,
    };
  }
  if (lower > 0) {
    return {
      label: 'Lägre än jämförelser',
      tone: 'positive',
      summary: `P/E ${pe.toFixed(1)} ligger tydligt lägre än minst en relevant jämförelse.`,
      evidence,
      availableComparisons: comparisons.length,
      totalComparisons: 2,
    };
  }
  if (higher > 0) {
    return {
      label: 'Högre än jämförelser',
      tone: 'negative',
      summary: `P/E ${pe.toFixed(1)} ligger tydligt högre än minst en relevant jämförelse.`,
      evidence,
      availableComparisons: comparisons.length,
      totalComparisons: 2,
    };
  }

  return {
    label: 'Nära jämförelser',
    tone: 'neutral',
    summary: `P/E ${pe.toFixed(1)} ligger nära tillgängliga jämförelser.`,
    evidence,
    availableComparisons: comparisons.length,
    totalComparisons: 2,
  };
}
