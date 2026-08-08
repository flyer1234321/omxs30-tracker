import assert from 'node:assert/strict';
import test from 'node:test';
import { assessValuation } from './valuation';
import type { StockData } from '@/types/stock';

type ValuationInput = Pick<StockData, 'trailingPE' | 'valuation' | 'sector'>;

function stock(overrides: Partial<ValuationInput> = {}): ValuationInput {
  return {
    trailingPE: 12,
    sector: 'Industrials',
    valuation: {
      trailingPEProxyMedian: null,
      trailingPESectorMedian: null,
      sectorSampleSize: 0,
    },
    ...overrides,
  };
}

test('does not call a low absolute P/E attractive without a comparison', () => {
  const assessment = assessValuation(stock({ trailingPE: 5 }));
  assert.equal(assessment.tone, 'unknown');
  assert.equal(assessment.label, 'Otillräckligt underlag');
});

test('uses both the transparent price proxy and a sufficiently broad sector sample', () => {
  const assessment = assessValuation(stock({
    trailingPE: 12,
    valuation: {
      trailingPEProxyMedian: 18,
      trailingPESectorMedian: 16,
      sectorSampleSize: 7,
    },
  }));
  assert.equal(assessment.tone, 'positive');
  assert.equal(assessment.availableComparisons, 2);
  assert.match(assessment.evidence.join(' '), /prisproxy|proxy/i);
  assert.match(assessment.evidence.join(' '), /7 bolag/);
});

test('ignores a sector comparison based on fewer than three companies', () => {
  const assessment = assessValuation(stock({
    valuation: {
      trailingPEProxyMedian: null,
      trailingPESectorMedian: 20,
      sectorSampleSize: 2,
    },
  }));
  assert.equal(assessment.tone, 'unknown');
  assert.equal(assessment.availableComparisons, 0);
});

test('shows mixed evidence instead of forcing a directional label', () => {
  const assessment = assessValuation(stock({
    trailingPE: 15,
    valuation: {
      trailingPEProxyMedian: 20,
      trailingPESectorMedian: 11,
      sectorSampleSize: 5,
    },
  }));
  assert.equal(assessment.tone, 'neutral');
  assert.equal(assessment.label, 'Blandad jämförelse');
});
