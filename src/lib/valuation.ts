import type { StockData } from '@/types/stock';
import type { AppLanguage } from '@/lib/language';

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

function comparisonText(prefix: string, difference: number, language: AppLanguage) {
  const magnitude = Math.abs(difference).toFixed(0);
  if (difference <= -5) return language === 'en' ? `${magnitude}% below ${prefix}` : `${magnitude} % under ${prefix}`;
  if (difference >= 5) return language === 'en' ? `${magnitude}% above ${prefix}` : `${magnitude} % över ${prefix}`;
  return language === 'en' ? `in line with ${prefix}` : `i linje med ${prefix}`;
}

/**
 * Bedömer bara relativ värdering. Ett P/E blir aldrig kallat billigt eller dyrt
 * enbart för att det passerar en generell gräns.
 */
export function assessValuation(stock: Pick<StockData, 'trailingPE' | 'valuation' | 'sector'>, language: AppLanguage = 'sv'): ValuationAssessment {
  const en = language === 'en';
  const pe = stock.trailingPE;
  if (pe == null || pe <= 0) {
    return {
      label: en ? 'Insufficient data' : 'Otillräckligt underlag',
      tone: 'unknown',
      summary: en ? 'Positive earnings and comparable P/E data are unavailable.' : 'Positiv vinst och jämförbar P/E-data saknas.',
      evidence: [],
      availableComparisons: 0,
      totalComparisons: 2,
    };
  }

  const comparisons: { difference: number; text: string }[] = [];
  const ownMedian = stock.valuation?.trailingPEProxyMedian;
  if (ownMedian != null && ownMedian > 0) {
    const difference = relativeDifference(pe, ownMedian);
    comparisons.push({ difference, text: comparisonText(en ? "the 12-month price proxy using today's EPS" : '12-månadersproxy med dagens VPA', difference, language) });
  }

  const sectorMedian = stock.valuation?.trailingPESectorMedian;
  const sectorSampleSize = stock.valuation?.sectorSampleSize ?? 0;
  if (sectorMedian != null && sectorMedian > 0 && sectorSampleSize >= 3) {
    const difference = relativeDifference(pe, sectorMedian);
    const sectorLabel = stock.sector ? (en ? `${stock.sector} sector` : `sektorn ${stock.sector}`) : (en ? 'the sector median' : 'sektorns median');
    comparisons.push({ difference, text: `${comparisonText(sectorLabel, difference, language)} (${sectorSampleSize} ${en ? 'companies' : 'bolag'})` });
  }

  if (!comparisons.length) {
    return {
      label: en ? 'Insufficient data' : 'Otillräckligt underlag',
      tone: 'unknown',
      summary: en ? `P/E is ${pe.toFixed(1)}, but relevant comparisons are unavailable.` : `P/E är ${pe.toFixed(1)}, men relevanta jämförelser saknas.`,
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
      label: en ? 'Mixed comparison' : 'Blandad jämförelse',
      tone: 'neutral',
      summary: en ? `P/E ${pe.toFixed(1)} gives mixed signals versus the price proxy and sector.` : `P/E ${pe.toFixed(1)} ger olika besked mot prisproxy och sektor.`,
      evidence,
      availableComparisons: comparisons.length,
      totalComparisons: 2,
    };
  }
  if (lower > 0) {
    return {
      label: en ? 'Below comparisons' : 'Lägre än jämförelser',
      tone: 'positive',
      summary: en ? `P/E ${pe.toFixed(1)} is clearly below at least one relevant comparison.` : `P/E ${pe.toFixed(1)} ligger tydligt lägre än minst en relevant jämförelse.`,
      evidence,
      availableComparisons: comparisons.length,
      totalComparisons: 2,
    };
  }
  if (higher > 0) {
    return {
      label: en ? 'Above comparisons' : 'Högre än jämförelser',
      tone: 'negative',
      summary: en ? `P/E ${pe.toFixed(1)} is clearly above at least one relevant comparison.` : `P/E ${pe.toFixed(1)} ligger tydligt högre än minst en relevant jämförelse.`,
      evidence,
      availableComparisons: comparisons.length,
      totalComparisons: 2,
    };
  }

  return {
    label: en ? 'Near comparisons' : 'Nära jämförelser',
    tone: 'neutral',
    summary: en ? `P/E ${pe.toFixed(1)} is close to the available comparisons.` : `P/E ${pe.toFixed(1)} ligger nära tillgängliga jämförelser.`,
    evidence,
    availableComparisons: comparisons.length,
    totalComparisons: 2,
  };
}
