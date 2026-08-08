/**
 * Kvalitetsmått ur balans- och resultaträkningen.
 *
 * Hälsobetyget svarar på frågan "har kursen fallit?" - fyra av dess sex
 * grundkriterier mäter samma nedgång på olika sätt. Det som avgör om ett fall
 * är ett tillfälle eller en varning finns inte där: skuldsättning, kassaflöde
 * och lönsamhet.
 *
 * SBB uppfyllde nästan varje tekniskt kriterium hela vägen från 40 kronor till
 * under 4. Det som gick att se i förväg fanns i balansräkningen, inte i kursen.
 *
 * Måtten är trubbiga och bygger på ett kvartalsgammalt underlag. De ersätter
 * inte att läsa rapporten, men de skiljer ett välskött bolag i rekyl från ett
 * bolag som faller av goda skäl.
 */

export interface QualityInput {
  sector?: string | null;
  /** Yahoo anger skuld genom eget kapital i procent, alltså 175 för 175 %. */
  debtToEquity?: number | null;
  totalDebt?: number | null;
  totalCash?: number | null;
  ebitda?: number | null;
  currentRatio?: number | null;
  freeCashflow?: number | null;
  returnOnEquity?: number | null;
  operatingMargins?: number | null;
  profitMargins?: number | null;
  revenueGrowth?: number | null;
  marketCap?: number | null;
}

export type QualityComponentId = 'debt' | 'profitability' | 'margin' | 'cashflow' | 'growth';

export interface QualityComponent {
  id: QualityComponentId;
  label: string;
  /** 0, 1 eller 2 poäng. null när underlaget saknas. */
  points: number | null;
  detail: string;
}

export interface QualityScore {
  /** 0-10, omräknad när någon komponent saknas eller inte är tillämplig. */
  score: number;
  /** Hur många komponenter som faktiskt kunde bedömas. */
  measured: number;
  components: QualityComponent[];
  label: 'Stark' | 'Godtagbar' | 'Svag' | 'Otillräckligt underlag';
  /** Sektorer där skuldsättning inte går att jämföra rakt av. */
  debtNotComparable: boolean;
}

/**
 * Banker och fastighetsbolag har hög skuldsättning som affärsmodell, inte som
 * varningstecken. Att jämföra deras nyckeltal med ett verkstadsbolags är
 * meningslöst, så skuldkomponenten utgår för dem.
 */
const LEVERAGED_BY_DESIGN = ['financial services', 'financials', 'real estate', 'banks'];

function isLeveragedByDesign(sector: string | null | undefined) {
  const normalized = sector?.toLowerCase() ?? '';
  return LEVERAGED_BY_DESIGN.some((candidate) => normalized.includes(candidate));
}

function scoreDebt(input: QualityInput): QualityComponent {
  const { totalDebt, totalCash, ebitda, debtToEquity } = input;

  // Nettoskuld genom rörelseresultat före avskrivningar är det mått som bäst
  // fångar om skulden går att bära. Saknas det används skuld genom eget kapital.
  if (totalDebt != null && ebitda != null && ebitda > 0) {
    const netDebt = totalDebt - (totalCash ?? 0);
    const ratio = netDebt / ebitda;
    const points = ratio <= 1 ? 2 : ratio <= 3 ? 1 : 0;
    return {
      id: 'debt',
      label: 'Skuldsättning',
      points,
      detail: `Nettoskuld / EBITDA: ${ratio.toFixed(1)}x${ratio > 3 ? ' (ansträngt)' : ratio <= 1 ? ' (lågt)' : ''}`,
    };
  }

  if (debtToEquity != null) {
    const points = debtToEquity <= 50 ? 2 : debtToEquity <= 150 ? 1 : 0;
    return {
      id: 'debt',
      label: 'Skuldsättning',
      points,
      detail: `Skuld / eget kapital: ${debtToEquity.toFixed(0)} %`,
    };
  }

  return { id: 'debt', label: 'Skuldsättning', points: null, detail: 'Underlag saknas' };
}

function scoreProfitability(input: QualityInput): QualityComponent {
  const roe = input.returnOnEquity;
  if (roe == null) return { id: 'profitability', label: 'Avkastning på eget kapital', points: null, detail: 'Underlag saknas' };

  const percent = roe * 100;
  const points = percent >= 15 ? 2 : percent >= 8 ? 1 : 0;
  return {
    id: 'profitability',
    label: 'Avkastning på eget kapital',
    points,
    detail: `ROE: ${percent.toFixed(1)} %${percent < 0 ? ' (förlust)' : ''}`,
  };
}

function scoreMargin(input: QualityInput): QualityComponent {
  const margin = input.operatingMargins ?? input.profitMargins;
  if (margin == null) return { id: 'margin', label: 'Rörelsemarginal', points: null, detail: 'Underlag saknas' };

  const percent = margin * 100;
  const points = percent >= 15 ? 2 : percent >= 5 ? 1 : 0;
  return {
    id: 'margin',
    label: 'Rörelsemarginal',
    points,
    detail: `${percent.toFixed(1)} %`,
  };
}

function scoreCashflow(input: QualityInput): QualityComponent {
  const { freeCashflow, marketCap } = input;
  if (freeCashflow == null) return { id: 'cashflow', label: 'Fritt kassaflöde', points: null, detail: 'Underlag saknas' };

  if (freeCashflow <= 0) {
    return { id: 'cashflow', label: 'Fritt kassaflöde', points: 0, detail: 'Negativt: bolaget förbrukar kassa' };
  }

  // Kassaflödet ställt mot börsvärdet säger mer än beloppet i sig.
  if (marketCap != null && marketCap > 0) {
    const yieldPercent = (freeCashflow / marketCap) * 100;
    const points = yieldPercent >= 5 ? 2 : yieldPercent >= 2 ? 1 : 0;
    return {
      id: 'cashflow',
      label: 'Fritt kassaflöde',
      points,
      detail: `${yieldPercent.toFixed(1)} % av börsvärdet`,
    };
  }

  return { id: 'cashflow', label: 'Fritt kassaflöde', points: 1, detail: 'Positivt' };
}

function scoreGrowth(input: QualityInput): QualityComponent {
  const growth = input.revenueGrowth;
  if (growth == null) return { id: 'growth', label: 'Omsättningstillväxt', points: null, detail: 'Underlag saknas' };

  const percent = growth * 100;
  const points = percent >= 8 ? 2 : percent >= 0 ? 1 : 0;
  return {
    id: 'growth',
    label: 'Omsättningstillväxt',
    points,
    detail: `${percent >= 0 ? '+' : ''}${percent.toFixed(1)} % mot samma kvartal i fjol${percent < 0 ? ' (krympande)' : ''}`,
  };
}

export function calculateQualityScore(input: QualityInput): QualityScore {
  const debtNotComparable = isLeveragedByDesign(input.sector);

  const components: QualityComponent[] = [
    debtNotComparable
      ? {
        id: 'debt' as const,
        label: 'Skuldsättning',
        points: null,
        detail: 'Utgår: hög skuldsättning hör till affärsmodellen i den här sektorn',
      }
      : scoreDebt(input),
    scoreProfitability(input),
    scoreMargin(input),
    scoreCashflow(input),
    scoreGrowth(input),
  ];

  const measured = components.filter((component) => component.points != null);
  if (measured.length < 3) {
    return { score: 0, measured: measured.length, components, label: 'Otillräckligt underlag', debtNotComparable };
  }

  // Poängen räknas om till skalan 0-10 utifrån de komponenter som gick att
  // bedöma, så att ett saknat värde inte i sig sänker betyget.
  const earned = measured.reduce((sum, component) => sum + (component.points ?? 0), 0);
  const score = (earned / (measured.length * 2)) * 10;

  return {
    score,
    measured: measured.length,
    components,
    label: score >= 7 ? 'Stark' : score >= 4 ? 'Godtagbar' : 'Svag',
    debtNotComparable,
  };
}
