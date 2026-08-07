import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPrintReportHtml } from './print-report';
import type { StockData } from '@/types/stock';

const stock: StockData = {
  ticker: 'TEST.ST', companyName: 'Test & Co <AB>', currentPrice: 123.45, sma50: 120, sma125: 115, sma200: 110, rsi: 54,
  diffPercent125: 7, chartHistory: [{ date: '2026-01-01', close: 110 }, { date: '2026-01-02', close: 123.45 }],
  fiftyTwoWeekHigh: 130, fiftyTwoWeekLow: 90, trailingPE: 14, dividendYield: 0.04, marketCap: 1_500_000_000,
  regularMarketChangePercent: 1.5, regularMarketOpen: 121, regularMarketDayHigh: 125, regularMarketDayLow: 120,
  regularMarketPreviousClose: 121.5, epsTrailingTwelveMonths: 8.8, latestVolume: 1_200_000, avgVolume20: 900_000,
  volatility: 22, beta: 0.9, maxDrawdown: 18, riskRewardScore: 75, healthCheck: null,
};

test('builds a printable report and escapes market data text', () => {
  const html = buildPrintReportHtml(stock, null);
  assert.match(html, /TEST/);
  assert.match(html, /Test &amp; Co &lt;AB&gt;/);
  assert.match(html, /Nyckeltal/);
  assert.match(html, /Kursutveckling/);
});
