import assert from 'node:assert/strict';
import test from 'node:test';
import type { StockData } from '@/types/stock';
import { buildAnalystContext } from './analyst-context';

function stock(): StockData {
  const chartHistory = Array.from({ length: 260 }, (_, index) => ({
    date: `2025-${String(Math.floor(index / 28) + 1).padStart(2, '0')}-${String((index % 28) + 1).padStart(2, '0')}`,
    close: 100 + index,
    volume: 1_000 + index,
  }));

  return {
    ticker: 'TEST.ST', companyName: 'Test AB', sector: 'Industrials', currency: 'SEK', currentPrice: 359,
    sma50: 340, sma125: 320, sma200: 300, rsi: 58, diffPercent125: 12.2, chartHistory,
    fiftyTwoWeekHigh: 370, fiftyTwoWeekLow: 180, trailingPE: 14, dividendYield: 0.025,
    marketCap: 20_000_000_000, regularMarketChangePercent: 1.2, regularMarketOpen: 355,
    regularMarketDayHigh: 362, regularMarketDayLow: 352, regularMarketPreviousClose: 354.75,
    epsTrailingTwelveMonths: 25.64, latestVolume: 1_500_000, avgVolume20: 1_000_000,
    volatility: 24, beta: 0.9, maxDrawdown: 18,
    healthCheck: {
      grade: 'B', gradeScore: 7, summary: 'Test', riskLevel: 'Medel', momentum: 'Uppåt',
      checklist: [{ label: 'Trend', passed: true, detail: 'Över SMA' }], bonuses: [],
    },
    valuation: { trailingPEProxyMedian: 17, trailingPESectorMedian: 19, sectorSampleSize: 5 },
    signals: [{ kind: 'volumeSpike', label: 'Hög volym', detail: '1,5x normal volym', tone: 'attention', observedAt: '2026-08-08' }],
    macdData: { trend: 'up' }, atr: 8,
    tradePlan: {
      atr: 8, atrPercent: 2.2, stopLoss: 343, stopBasis: '2 x ATR', target: 390,
      targetBasis: 'Motstånd', riskPerShare: 16, riskPercent: 4.5, rewardPercent: 8.6, rMultiple: 1.9,
    },
    relativeStrength63: 6.4, earningsTimestamp: Date.UTC(2026, 7, 18), priceToBook: 2.1, bookValue: 171,
    quality: {
      score: 8, measured: 5, label: 'Stark', debtNotComparable: false,
      components: [{ id: 'cashflow', label: 'Fritt kassaflöde', points: 2, detail: '6,0 % av börsvärdet' }],
    },
  };
}

test('includes the relevant market, technical, fundamental, event and trade-plan data', () => {
  const context = buildAnalystContext(stock(), new Date('2026-08-08T12:00:00Z'));

  assert.equal(context.market.relativeVolume, 1.5);
  assert.equal(context.market.recentPriceAction.length, 20);
  assert.ok(context.market.periodReturnsPercent.oneYear != null);
  assert.equal(context.technical.macdTrend, 'up');
  assert.equal(context.technical.relativeStrengthVsIndex63SessionsPercentPoints, 6.4);
  assert.equal(context.technical.signals[0].detail, '1,5x normal volym');
  assert.equal(context.valuation.priceToBook, 2.1);
  assert.equal(context.fundamentalQuality?.components[0].detail, '6,0 % av börsvärdet');
  assert.equal(context.event.nextEarnings.daysUntil, 10);
  assert.equal(context.tradePlan?.stopLoss, 343);
  assert.equal(context.rekylModel?.grade, 'B');
});

test('keeps unavailable values explicit instead of inventing data', () => {
  const sparse = stock();
  sparse.avgVolume20 = null;
  sparse.quality = null;
  sparse.tradePlan = null;
  sparse.earningsTimestamp = null;

  const context = buildAnalystContext(sparse, new Date('2026-08-08T12:00:00Z'));
  assert.equal(context.market.relativeVolume, null);
  assert.equal(context.fundamentalQuality, null);
  assert.equal(context.tradePlan, null);
  assert.deepEqual(context.event.nextEarnings, { date: null, daysUntil: null });
});
