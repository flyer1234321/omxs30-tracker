import type { ChartDataPoint } from '@/types/stock';

export type ChartPeriod = '1D' | '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | '2Y' | '5Y' | '10Y' | 'ALL';

export const chartPeriods: { id: ChartPeriod; label: string }[] = [
  { id: '1D', label: '1D' },
  { id: '1W', label: '1V' },
  { id: '1M', label: '1M' },
  { id: '3M', label: '3M' },
  { id: '6M', label: '6M' },
  { id: 'YTD', label: 'I ÅR' },
  { id: '1Y', label: '1 Å' },
  { id: '2Y', label: '2 Å' },
  { id: '5Y', label: '5 Å' },
  { id: '10Y', label: '10 Å' },
  { id: 'ALL', label: 'Alla' },
];

export function downsampleChartData(data: ChartDataPoint[], maximumPoints = 180): ChartDataPoint[] {
  if (data.length <= maximumPoints) return data;

  const stride = Math.ceil(data.length / maximumPoints);
  const sampled = data.filter((_, index) => index % stride === 0);
  const latest = data.at(-1);

  if (latest && sampled.at(-1) !== latest) sampled.push(latest);
  return sampled;
}

export function calculatePeriodPerformance(data: ChartDataPoint[]) {
  const first = data.find((point) => Number.isFinite(point.close));
  const latest = data.at(-1);
  if (!first || !latest || first.close === 0 || !Number.isFinite(latest.close)) return null;

  const absolute = latest.close - first.close;
  return { absolute, percent: (absolute / first.close) * 100 };
}

export function buildVolumeBars(data: ChartDataPoint[], maximumBars = 72): number[] {
  if (!data.length) return [];

  const bucketSize = Math.max(1, Math.ceil(data.length / maximumBars));
  const volumes: number[] = [];
  for (let index = 0; index < data.length; index += bucketSize) {
    const bucket = data.slice(index, index + bucketSize);
    const total = bucket.reduce((sum, point) => sum + Math.max(point.volume || 0, 0), 0);
    volumes.push(total / bucket.length);
  }
  return volumes;
}
