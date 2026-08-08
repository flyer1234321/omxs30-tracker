import { assessValuation } from '@/lib/valuation';
import { roundMarketValue } from '@/lib/market-values';
import type { ChartDataPoint, StockData } from '@/types/stock';

const RECENT_SESSION_COUNT = 20;

function percentDistance(value: number | null | undefined, reference: number | null | undefined) {
  if (value == null || reference == null || reference === 0) return null;
  return roundMarketValue(((value - reference) / reference) * 100, 1);
}

function returnOverSessions(history: ChartDataPoint[], sessions: number) {
  if (history.length <= sessions) return null;
  const latest = history.at(-1)?.close;
  const earlier = history.at(-(sessions + 1))?.close;
  if (latest == null || earlier == null || earlier === 0) return null;
  return roundMarketValue(((latest - earlier) / earlier) * 100, 1);
}

function earningsContext(timestamp: number | null, now: Date) {
  if (timestamp == null || !Number.isFinite(timestamp)) return { date: null, daysUntil: null };
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return { date: null, daysUntil: null };
  return {
    date: date.toISOString(),
    daysUntil: Math.ceil((date.getTime() - now.getTime()) / 86_400_000),
  };
}

/**
 * Ett komplett men token-effektivt underlag för AI-analysen. Rå kurshistorik
 * sammanfattas till periodavkastningar och de senaste handelstillfällena.
 */
export function buildAnalystContext(stock: StockData, now = new Date()) {
  const valuation = assessValuation(stock);
  const relativeVolume = stock.latestVolume != null && stock.avgVolume20 != null && stock.avgVolume20 > 0
    ? roundMarketValue(stock.latestVolume / stock.avgVolume20, 2)
    : null;

  return {
    analysisAsOf: now.toISOString(),
    dataSource: 'Yahoo Finance; data kan vara fördröjd och bolagsdata kan avse senaste rapporterade period.',
    identity: {
      ticker: stock.ticker,
      companyName: stock.companyName,
      sector: stock.sector,
      currency: stock.currency,
    },
    market: {
      currentPrice: roundMarketValue(stock.currentPrice),
      changePercent: roundMarketValue(stock.regularMarketChangePercent, 1),
      previousClose: roundMarketValue(stock.regularMarketPreviousClose),
      open: roundMarketValue(stock.regularMarketOpen),
      dayHigh: roundMarketValue(stock.regularMarketDayHigh),
      dayLow: roundMarketValue(stock.regularMarketDayLow),
      marketCap: roundMarketValue(stock.marketCap, 0),
      latestVolume: roundMarketValue(stock.latestVolume, 0),
      averageVolume20: roundMarketValue(stock.avgVolume20, 0),
      relativeVolume,
      fiftyTwoWeekHigh: roundMarketValue(stock.fiftyTwoWeekHigh),
      fiftyTwoWeekLow: roundMarketValue(stock.fiftyTwoWeekLow),
      distanceFromFiftyTwoWeekHighPercent: percentDistance(stock.currentPrice, stock.fiftyTwoWeekHigh),
      distanceFromFiftyTwoWeekLowPercent: percentDistance(stock.currentPrice, stock.fiftyTwoWeekLow),
      periodReturnsPercent: {
        oneWeek: returnOverSessions(stock.chartHistory, 5),
        oneMonth: returnOverSessions(stock.chartHistory, 21),
        threeMonths: returnOverSessions(stock.chartHistory, 63),
        sixMonths: returnOverSessions(stock.chartHistory, 126),
        oneYear: returnOverSessions(stock.chartHistory, 252),
      },
      recentPriceAction: stock.chartHistory.slice(-RECENT_SESSION_COUNT).map((point) => ({
        date: point.date,
        close: roundMarketValue(point.close),
        volume: roundMarketValue(point.volume, 0),
      })),
    },
    technical: {
      rsi14: roundMarketValue(stock.rsi, 1),
      sma50: roundMarketValue(stock.sma50),
      sma125: roundMarketValue(stock.sma125),
      sma200: roundMarketValue(stock.sma200),
      distanceFromSma50Percent: percentDistance(stock.currentPrice, stock.sma50),
      distanceFromSma125Percent: percentDistance(stock.currentPrice, stock.sma125),
      distanceFromSma200Percent: percentDistance(stock.currentPrice, stock.sma200),
      macdTrend: stock.macdData?.trend ?? null,
      atr14: roundMarketValue(stock.atr),
      atrPercent: stock.atr != null && stock.currentPrice > 0
        ? roundMarketValue((stock.atr / stock.currentPrice) * 100, 1)
        : null,
      relativeStrengthVsIndex63SessionsPercentPoints: roundMarketValue(stock.relativeStrength63, 1),
      signals: (stock.signals ?? []).map((signal) => ({
        kind: signal.kind,
        label: signal.label,
        detail: signal.detail,
        observedAt: signal.observedAt,
      })),
    },
    valuation: {
      trailingPE: roundMarketValue(stock.trailingPE, 1),
      epsTrailingTwelveMonths: roundMarketValue(stock.epsTrailingTwelveMonths),
      priceToBook: roundMarketValue(stock.priceToBook, 2),
      bookValuePerShare: roundMarketValue(stock.bookValue),
      dividendYieldPercent: stock.dividendYield == null
        ? null
        : roundMarketValue(stock.dividendYield * 100, 1),
      trailingPEPriceProxyMedian: roundMarketValue(stock.valuation?.trailingPEProxyMedian, 1),
      trailingPESectorMedian: roundMarketValue(stock.valuation?.trailingPESectorMedian, 1),
      sectorSampleSize: stock.valuation?.sectorSampleSize ?? 0,
      assessment: {
        label: valuation.label,
        summary: valuation.summary,
        evidence: valuation.evidence,
        availableComparisons: valuation.availableComparisons,
        totalComparisons: valuation.totalComparisons,
      },
    },
    fundamentalQuality: stock.quality ? {
      score: roundMarketValue(stock.quality.score, 1),
      label: stock.quality.label,
      measuredComponents: stock.quality.measured,
      debtNotComparable: stock.quality.debtNotComparable,
      components: stock.quality.components.map((component) => ({
        id: component.id,
        label: component.label,
        points: component.points,
        detail: component.detail,
      })),
    } : null,
    risk: {
      beta: roundMarketValue(stock.beta, 2),
      volatility20SessionsAnnualizedPercent: roundMarketValue(stock.volatility, 1),
      maxDrawdownPercent: roundMarketValue(stock.maxDrawdown, 1),
    },
    event: {
      nextEarnings: earningsContext(stock.earningsTimestamp, now),
    },
    tradePlan: stock.tradePlan ? {
      atr: roundMarketValue(stock.tradePlan.atr),
      atrPercent: roundMarketValue(stock.tradePlan.atrPercent, 1),
      stopLoss: roundMarketValue(stock.tradePlan.stopLoss),
      stopBasis: stock.tradePlan.stopBasis,
      target: roundMarketValue(stock.tradePlan.target),
      targetBasis: stock.tradePlan.targetBasis,
      riskPerShare: roundMarketValue(stock.tradePlan.riskPerShare),
      riskPercent: roundMarketValue(stock.tradePlan.riskPercent, 1),
      rewardPercent: roundMarketValue(stock.tradePlan.rewardPercent, 1),
      rMultiple: roundMarketValue(stock.tradePlan.rMultiple, 1),
    } : null,
    rekylModel: stock.healthCheck ? {
      grade: stock.healthCheck.grade,
      gradeScore: stock.healthCheck.gradeScore,
      summary: stock.healthCheck.summary,
      riskLevel: stock.healthCheck.riskLevel,
      momentum: stock.healthCheck.momentum,
      checklist: stock.healthCheck.checklist,
      bonuses: stock.healthCheck.bonuses,
    } : null,
  };
}

export type AnalystContext = ReturnType<typeof buildAnalystContext>;
