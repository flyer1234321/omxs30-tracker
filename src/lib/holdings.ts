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
 * Summerar positionerna. Blandade valutor summeras rakt av och flaggas: en
 * växelkurs vore fel att gissa, och en tyst felaktig totalsumma är sämre än en
 * summa med en tydlig reservation.
 */
export function summarisePortfolio(positions: HoldingPosition[]): PortfolioSummary {
  const currencies = new Set(positions.map((position) => position.currency ?? 'okänd'));

  const marketValue = positions.reduce((sum, position) => sum + position.marketValue, 0);
  const costBasis = positions.reduce((sum, position) => sum + position.costBasis, 0);
  const unrealisedAmount = marketValue - costBasis;

  return {
    positions,
    marketValue,
    costBasis,
    unrealisedAmount,
    unrealisedPercent: costBasis > 0 ? (unrealisedAmount / costBasis) * 100 : 0,
    dayChangeAmount: positions.reduce((sum, position) => sum + (position.dayChangeAmount ?? 0), 0),
    riskToStopAmount: positions.reduce((sum, position) => sum + (position.riskToStopAmount ?? 0), 0),
    mixedCurrencies: currencies.size > 1,
    currency: currencies.size === 1 ? positions[0]?.currency ?? null : null,
  };
}

/** Positionens andel av portföljen, i procent. */
export function portfolioWeight(position: HoldingPosition, summary: PortfolioSummary) {
  return summary.marketValue > 0 ? (position.marketValue / summary.marketValue) * 100 : 0;
}

/**
 * Varnar när kursen ligger orimligt långt från det registrerade
 * anskaffningsvärdet.
 *
 * Det vanligaste skälet är en aktiesplit: antalet aktier och kursen ändras,
 * men det som står i appen gör det inte. Eftersom Yahoo levererar
 * splitjusterade kurser blir felet annars osynligt - avkastningen ser bara
 * märkligt stor ut åt ena hållet.
 */
export function looksLikeSplit(position: HoldingPosition) {
  if (!(position.averagePrice > 0)) return false;
  const ratio = position.marketValue / position.costBasis;
  return ratio >= 1.9 || ratio <= 0.55;
}
