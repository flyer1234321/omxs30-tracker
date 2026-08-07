import type { TradePlan } from '@/types/stock';

export interface TradePlanInput {
  currentPrice: number;
  atr: number | null;
  sma50: number | null;
  sma125: number | null;
  sma200: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
}

interface Level {
  price: number;
  label: string;
}

function levelsBelow(input: TradePlanInput): Level[] {
  return ([
    { price: input.sma50, label: 'SMA 50' },
    { price: input.sma125, label: 'SMA 125' },
    { price: input.sma200, label: 'SMA 200' },
    { price: input.fiftyTwoWeekLow, label: '52v-lägsta' },
  ] as { price: number | null; label: string }[])
    .filter((level): level is Level => level.price != null && level.price > 0 && level.price < input.currentPrice)
    .sort((a, b) => b.price - a.price);
}

function levelsAbove(input: TradePlanInput): Level[] {
  return ([
    { price: input.sma50, label: 'SMA 50' },
    { price: input.sma125, label: 'SMA 125' },
    { price: input.sma200, label: 'SMA 200' },
    { price: input.fiftyTwoWeekHigh, label: '52v-högsta' },
  ] as { price: number | null; label: string }[])
    .filter((level): level is Level => level.price != null && level.price > 0 && level.price > input.currentPrice)
    .sort((a, b) => a.price - b.price);
}

/**
 * Översätter volatilitet och närliggande nivåer till en konkret plan:
 * var stoppar man ur, vart kan det rimligen gå, och hur förhåller sig de två
 * till varandra.
 *
 * Poängen är att ersätta "Risk/Reward 73 av 100", som inte går att agera på,
 * med tal i kronor och procent. Nivåerna är mekaniska och säger ingenting om
 * bolaget - de beskriver bara var kursen historiskt har mött motstånd och hur
 * mycket den brukar röra sig på en dag.
 */
export function buildTradePlan(input: TradePlanInput, stopAtrMultiple = 2): TradePlan | null {
  const { currentPrice, atr } = input;
  if (!atr || !(atr > 0) || !(currentPrice > 0)) return null;

  const rawStop = currentPrice - stopAtrMultiple * atr;
  if (rawStop <= 0) return null;

  // Ligger ett glidande medelvärde strax under den volatilitetsbaserade
  // stoppen används det istället: nivån är mer sannolik som stödområde.
  const supports = levelsBelow(input);
  const nearbySupport = supports.find((level) => level.price < currentPrice && level.price >= rawStop * 0.97 && level.price <= rawStop * 1.03);
  const stopLoss = nearbySupport ? nearbySupport.price * 0.995 : rawStop;
  const stopBasis = nearbySupport
    ? `Strax under ${nearbySupport.label}`
    : `${stopAtrMultiple} x ATR under kursen`;

  const resistances = levelsAbove(input);
  const nearestResistance = resistances[0];
  const atrTarget = currentPrice + 3 * atr;
  const useResistance = nearestResistance != null && nearestResistance.price <= atrTarget * 1.5;
  const target = useResistance ? nearestResistance.price : atrTarget;
  const targetBasis = useResistance ? `Närmaste motstånd: ${nearestResistance.label}` : '3 x ATR över kursen';

  const riskPercent = ((currentPrice - stopLoss) / currentPrice) * 100;
  const rewardPercent = ((target - currentPrice) / currentPrice) * 100;
  if (!(riskPercent > 0)) return null;

  return {
    atr,
    atrPercent: (atr / currentPrice) * 100,
    stopLoss,
    stopBasis,
    target,
    targetBasis,
    riskPerShare: currentPrice - stopLoss,
    riskPercent,
    rewardPercent,
    rMultiple: rewardPercent / riskPercent,
  };
}

/**
 * Hur många aktier man kan köpa om man vill riskera en bestämd summa fram till
 * stoppen. Används i detaljvyn och kräver inget sparat innehav.
 */
export function positionSizeForRisk(plan: TradePlan, riskAmount: number) {
  if (!(plan.riskPerShare > 0) || !(riskAmount > 0)) return null;
  return Math.floor(riskAmount / plan.riskPerShare);
}
