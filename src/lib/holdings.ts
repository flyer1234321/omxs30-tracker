import type { StockData } from '@/types/stock';

/**
 * Innehav: antal aktier och genomsnittligt anskaffningsvärde per bolag.
 *
 * Appen mätte tidigare aktien men visste ingenting om positionen. Utan
 * inköpspris går den avgörande frågan vid ett säljbeslut inte att besvara, och
 * handelsplanens risk stannar vid en procentsats i stället för ett belopp.
 *
 * Beräkningarna här är avsiktligt enkla och rena. De känner inte till courtage,
 * skatt eller utdelningar, och de bygger enbart på det användaren matat in.
 */

export interface Holding {
  ticker: string;
  /** Antal aktier. Bråkdelar tillåts, vissa mäklare handlar i andelar. */
  shares: number;
  /** Genomsnittligt anskaffningsvärde per aktie, i aktiens handelsvaluta. */
  averagePrice: number;
  updatedAt?: string | null;
}

export interface HoldingPosition {
  ticker: string;
  shares: number;
  averagePrice: number;
  currency: string | null;
  /** Marknadsvärde till senaste kurs. */
  marketValue: number;
  /** Vad positionen kostade. */
  costBasis: number;
  unrealisedAmount: number;
  unrealisedPercent: number;
  /** Dagens rörelse i kronor för just den här positionen. */
  dayChangeAmount: number | null;
  /** Belopp som står på spel ned till handelsplanens stoppnivå. */
  riskToStopAmount: number | null;
}

export function isValidHolding(holding: Partial<Holding> | null | undefined): holding is Holding {
  return Boolean(
    holding
    && typeof holding.ticker === 'string' && holding.ticker.length > 0
    && typeof holding.shares === 'number' && Number.isFinite(holding.shares) && holding.shares > 0
    && typeof holding.averagePrice === 'number' && Number.isFinite(holding.averagePrice) && holding.averagePrice > 0,
  );
}

export function buildPosition(stock: StockData, holding: Holding | undefined): HoldingPosition | null {
  if (!holding || !isValidHolding(holding) || !(stock.currentPrice > 0)) return null;

  const marketValue = holding.shares * stock.currentPrice;
  const costBasis = holding.shares * holding.averagePrice;
  const unrealisedAmount = marketValue - costBasis;

  const changePercent = stock.regularMarketChangePercent;
  const previousClose = stock.regularMarketPreviousClose;
  // Gårdagens stängning ger ett exaktare belopp än att räkna baklänges ur
  // procenttalet, men procenten duger när stängningen saknas.
  const dayChangeAmount = previousClose != null && previousClose > 0
    ? (stock.currentPrice - previousClose) * holding.shares
    : changePercent != null
      ? marketValue - marketValue / (1 + changePercent / 100)
      : null;

  const riskToStopAmount = stock.tradePlan
    ? Math.max(0, stock.currentPrice - stock.tradePlan.stopLoss) * holding.shares
    : null;

  return {
    ticker: stock.ticker,
    shares: holding.shares,
    averagePrice: holding.averagePrice,
    currency: stock.currency,
    marketValue,
    costBasis,
    unrealisedAmount,
    unrealisedPercent: costBasis > 0 ? (unrealisedAmount / costBasis) * 100 : 0,
    dayChangeAmount,
    riskToStopAmount,
  };
}

export interface PortfolioSummary {
  positions: HoldingPosition[];
  marketValue: number;
  costBasis: number;
  unrealisedAmount: number;
  unrealisedPercent: number;
  dayChangeAmount: number;
  /** Sammanlagt belopp ned till samtliga stoppnivåer. */
  riskToStopAmount: number;
  /** Sant när innehaven har olika handelsvaluta och summan därför inte går ihop. */
  mixedCurrencies: boolean;
  currency: string | null;
}

/**
 * Omvandlar ett belopp till SEK med hjälp av en schablonkurs.
 */
export function approximateSekValue(amount: number, currency: string | null | undefined): number {
  if (!currency || currency.toUpperCase() === 'SEK') return amount;
  const match = PLAUSIBLE_FX_RATES.find((candidate) => candidate.code === currency.toUpperCase());
  return amount * (match ? match.rate : 1);
}

/**
 * Summerar positionerna. Om portföljen innehåller flera valutor omvandlas
 * allt till SEK med schablonkurser för att ge korrekta totalbelopp och andelar.
 */
export function summarisePortfolio(positions: HoldingPosition[]): PortfolioSummary {
  const currencies = new Set(positions.map((position) => position.currency ?? 'okänd'));
  const mixedCurrencies = currencies.size > 1;

  const marketValue = positions.reduce((sum, position) => sum + (mixedCurrencies ? approximateSekValue(position.marketValue, position.currency) : position.marketValue), 0);
  const costBasis = positions.reduce((sum, position) => sum + (mixedCurrencies ? approximateSekValue(position.costBasis, position.currency) : position.costBasis), 0);
  const unrealisedAmount = marketValue - costBasis;

  return {
    positions,
    marketValue,
    costBasis,
    unrealisedAmount,
    unrealisedPercent: costBasis > 0 ? (unrealisedAmount / costBasis) * 100 : 0,
    dayChangeAmount: positions.reduce((sum, position) => sum + (mixedCurrencies ? approximateSekValue(position.dayChangeAmount ?? 0, position.currency) : (position.dayChangeAmount ?? 0)), 0),
    riskToStopAmount: positions.reduce((sum, position) => sum + (mixedCurrencies ? approximateSekValue(position.riskToStopAmount ?? 0, position.currency) : (position.riskToStopAmount ?? 0)), 0),
    mixedCurrencies,
    currency: mixedCurrencies ? 'SEK' : (positions[0]?.currency ?? null),
  };
}

/** Positionens andel av portföljen, i procent. */
export function portfolioWeight(position: HoldingPosition, summary: PortfolioSummary) {
  if (summary.marketValue === 0) return 0;
  if (summary.mixedCurrencies) {
    return (approximateSekValue(position.marketValue, position.currency) / summary.marketValue) * 100;
  }
  return (position.marketValue / summary.marketValue) * 100;
}

export type HoldingMismatch = 'currency' | 'split' | null;

/**
 * Växelkurser som gör en valutaförväxling igenkännbar. En svensk sparare som
 * lägger in sitt anskaffningsvärde i kronor på ett bolags amerikanska notering
 * får en avvikelse som ligger nära kursen, inte nära två.
 */
const PLAUSIBLE_FX_RATES = [
  { code: 'USD', rate: 10 },
  { code: 'EUR', rate: 11.5 },
  { code: 'GBP', rate: 13 },
  { code: 'NOK', rate: 1 },
  { code: 'DKK', rate: 1.5 },
];

/**
 * Avgör varför kursen ligger orimligt långt från registrerat
 * anskaffningsvärde, och skiljer på de två troliga orsakerna.
 *
 * **Valuta.** Har man matat in kronor på en aktie som handlas i dollar blir
 * avvikelsen ungefär växelkursen. Det är den vanligaste förväxlingen, eftersom
 * många svenska bolag också har en amerikansk notering som dyker upp i sökningen.
 *
 * **Split.** Delas aktien ändras antal och kurs, men det som står i appen gör
 * det inte. Eftersom Yahoo levererar splitjusterade kurser blir felet annars
 * osynligt: avkastningen ser bara märkligt stor ut åt ena hållet.
 *
 * Skillnaden spelar roll, för åtgärderna är olika. Vid valutaförväxling ska man
 * byta till rätt notering; vid split ska man räkna om antal och GAV.
 */
export function detectHoldingMismatch(position: HoldingPosition): HoldingMismatch {
  if (!(position.averagePrice > 0) || !(position.costBasis > 0)) return null;

  const ratio = position.marketValue / position.costBasis;
  if (ratio < 1.9 && ratio > 0.55) return null;

  // Handlas aktien i något annat än kronor, och ligger avvikelsen nära den
  // valutans kurs, är valutaförväxling den klart troligaste förklaringen.
  const currency = position.currency?.toUpperCase();
  if (currency && currency !== 'SEK') {
    const match = PLAUSIBLE_FX_RATES.find((candidate) => candidate.code === currency);
    if (match) {
      const impliedRate = 1 / ratio;
      if (impliedRate >= match.rate * 0.75 && impliedRate <= match.rate * 1.35) return 'currency';
    }
  }

  return 'split';
}

/** Behålls för bakåtkompatibilitet: sant när något ser fel ut, oavsett orsak. */
export function looksLikeSplit(position: HoldingPosition) {
  return detectHoldingMismatch(position) !== null;
}
