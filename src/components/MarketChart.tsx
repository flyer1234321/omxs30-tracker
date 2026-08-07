import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { HintedTouchable } from '@/components/HintedTouchable';
import { LineChart } from 'react-native-gifted-charts';
import type { ChartDataPoint, StockData } from '@/types/stock';
import {
  buildVolumeBars,
  calculatePeriodPerformance,
  chartPeriods,
  downsampleChartData,
  type ChartPeriod,
} from '@/lib/chart-presentation';
import { authenticatedFetch } from '@/lib/auth-client';

const colors = {
  surface: '#111118',
  text: '#FFFFFF',
  muted: '#8E8E93',
  green: '#34C759',
  red: '#FF453A',
  border: '#2A2A35',
  grid: '#20202A',
};

const remoteHistoryRanges: Partial<Record<ChartPeriod, string>> = {
  YTD: 'ytd',
  '2Y': '2y',
  '5Y': '5y',
  '10Y': '10y',
  ALL: 'max',
};

const pointCounts: Partial<Record<ChartPeriod, number>> = {
  '1M': 21,
  '3M': 63,
  '6M': 125,
  '1Y': 252,
};

function formatAxisValue(value: number) {
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toFixed(value >= 100 ? 0 : 1);
}

function formatPeriodLabel(date: string, period: ChartPeriod) {
  const value = new Date(date);
  if (period === '1D') {
    return `${value.getHours()}:${value.getMinutes().toString().padStart(2, '0')}`;
  }
  if (period === '1W') return ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'][value.getDay()];
  if (period === '1M' || period === '3M' || period === '6M') return `${value.getDate()}/${value.getMonth() + 1}`;
  return `${value.getMonth() + 1}/${String(value.getFullYear()).slice(-2)}`;
}

function periodTitle(period: ChartPeriod) {
  return chartPeriods.find((candidate) => candidate.id === period)?.label ?? period;
}

interface MarketChartProps {
  item: StockData;
}

export function MarketChart({ item }: MarketChartProps) {
  const { width } = useWindowDimensions();
  const [period, setPeriod] = useState<ChartPeriod>('6M');
  const [intraday, setIntraday] = useState<Partial<Record<ChartPeriod, ChartDataPoint[]>>>({});
  const [history, setHistory] = useState<Partial<Record<ChartPeriod, ChartDataPoint[]>>>({});
  const [loading, setLoading] = useState(false);
  const [showSma50, setShowSma50] = useState(false);
  const [showSma125, setShowSma125] = useState(true);
  const [showSma200, setShowSma200] = useState(false);

  useEffect(() => {
    setIntraday({});
    setHistory({});
  }, [item.ticker]);

  useEffect(() => {
    const intradayRange = period === '1D' ? '1d' : period === '1W' ? '5d' : null;
    const historyRange = remoteHistoryRanges[period];
    if ((!intradayRange && !historyRange) || intraday[period] || history[period]) return;

    let cancelled = false;
    setLoading(true);
    const url = intradayRange
      ? `/api/intraday?ticker=${encodeURIComponent(item.ticker)}&range=${intradayRange}`
      : `/api/history?ticker=${encodeURIComponent(item.ticker)}&range=${historyRange}`;

    authenticatedFetch(url)
      .then(async (response) => {
        if (!response.ok) throw new Error('Kunde inte hämta kurshistorik');
        return response.json();
      })
      .then((payload) => {
        if (cancelled || !Array.isArray(payload?.data)) return;
        if (intradayRange) setIntraday((previous) => ({ ...previous, [period]: payload.data }));
        else setHistory((previous) => ({ ...previous, [period]: payload.data }));
      })
      .catch((error) => console.error('Market chart request failed:', error))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [history, intraday, item.ticker, period]);

  const chartHistory = useMemo(() => {
    if (period === '1D' || period === '1W') return intraday[period] || [];
    if (remoteHistoryRanges[period]) return history[period] || [];
    const count = pointCounts[period] || 125;
    return item.chartHistory.slice(-count);
  }, [history, intraday, item.chartHistory, period]);

  const displayHistory = useMemo(() => downsampleChartData(chartHistory), [chartHistory]);
  const isIntraday = period === '1D' || period === '1W';
  const performance = useMemo(() => calculatePeriodPerformance(chartHistory), [chartHistory]);
  const isPositive = (performance?.absolute ?? 0) >= 0;
  const accent = isPositive ? colors.green : colors.red;
  const chartWidth = Math.max(260, width - 64);
  const volumeBars = useMemo(() => buildVolumeBars(chartHistory), [chartHistory]);
  const maximumVolume = Math.max(...volumeBars, 1);

  const priceData = useMemo(() => {
    const labelInterval = Math.max(1, Math.floor(displayHistory.length / 5));
    return displayHistory.map((point, index) => ({
      value: point.close,
      label: index % labelInterval === 0 || index === displayHistory.length - 1
        ? formatPeriodLabel(point.date, period)
        : '',
    }));
  }, [displayHistory, period]);

  const sma50Data = !isIntraday && showSma50
    ? displayHistory.map((point) => ({ value: point.sma50 ?? point.close }))
    : [];
  const sma125Data = !isIntraday && showSma125
    ? displayHistory.map((point) => ({ value: point.sma125 ?? point.close }))
    : [];
  const sma200Data = !isIntraday && showSma200
    ? displayHistory.map((point) => ({ value: point.sma200 ?? point.close }))
    : [];

  const allValues = [
    ...displayHistory.map((point) => point.close),
    ...sma50Data.map((point) => point.value),
    ...sma125Data.map((point) => point.value),
    ...sma200Data.map((point) => point.value),
  ].filter(Number.isFinite);
  const rawMin = Math.min(...allValues, item.currentPrice);
  const rawMax = Math.max(...allValues, item.currentPrice);
  const padding = Math.max((rawMax - rawMin) * 0.12, item.currentPrice * 0.008, 0.1);
  const yMin = Math.max(0, rawMin - padding);
  const yMax = rawMax + padding;
  const sections = 4;
  const stepValue = Math.max((yMax - yMin) / sections, 0.01);

  const showIndicators = !isIntraday && !remoteHistoryRanges[period];
  const rangeLabel = `${periodTitle(period)} ${isPositive ? 'upp' : 'ned'}`;

  return (
    <View style={styles.section}>
      <View style={styles.priceSummary}>
        <View>
          <Text style={styles.title}>Kursutveckling</Text>
          <Text style={styles.price}>{item.currentPrice.toFixed(2)} kr</Text>
        </View>
        <View style={styles.performanceWrap}>
          <Text style={[styles.performance, { color: accent }]}>
            {performance ? `${performance.absolute >= 0 ? '+' : ''}${performance.absolute.toFixed(2)} kr` : '-'}
          </Text>
          <Text style={[styles.performanceSub, { color: accent }]}>
            {performance ? `${performance.percent >= 0 ? '+' : ''}${performance.percent.toFixed(2)}% ${rangeLabel}` : 'Saknar perioddata'}
          </Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodTabs}>
        {chartPeriods.map((candidate) => (
          <HintedTouchable
            key={candidate.id}
            accessibilityRole="button"
            accessibilityState={{ selected: period === candidate.id }}
            accessibilityLabel={`Visa ${candidate.label}`}
            hint={`Visar kursutvecklingen för perioden ${candidate.label}.`}
            style={[styles.periodButton, period === candidate.id && styles.periodButtonActive]}
            onPress={() => setPeriod(candidate.id)}
          >
            <Text style={[styles.periodText, period === candidate.id && styles.periodTextActive]}>{candidate.label}</Text>
          </HintedTouchable>
        ))}
      </ScrollView>

      {showIndicators && (
        <View style={styles.indicatorRow}>
          <IndicatorToggle active={showSma50} color="#8B5CF6" label="SMA 50" onPress={() => setShowSma50((value) => !value)} />
          <IndicatorToggle active={showSma125} color="#F59E0B" label="SMA 125" onPress={() => setShowSma125((value) => !value)} />
          <IndicatorToggle active={showSma200} color="#FB2C55" label="SMA 200" onPress={() => setShowSma200((value) => !value)} />
        </View>
      )}

      {loading && chartHistory.length === 0 ? (
        <View style={styles.loading}><ActivityIndicator color={accent} /><Text style={styles.loadingText}>Hämtar kurshistorik</Text></View>
      ) : chartHistory.length === 0 ? (
        <View style={styles.loading}><Text style={styles.loadingText}>Ingen kurshistorik tillgänglig för perioden.</Text></View>
      ) : (
        <>
          <View pointerEvents="none" style={styles.chartWrap}>
            <LineChart
              key={`${item.ticker}-${period}-${width}`}
              data={priceData}
              data2={sma125Data.length ? sma125Data : undefined}
              data3={sma50Data.length ? sma50Data : undefined}
              data4={sma200Data.length ? sma200Data : undefined}
              width={chartWidth}
              height={218}
              color={accent}
              color2="#F59E0B"
              color3="#8B5CF6"
              color4="#FB2C55"
              thickness={2.5}
              thickness2={1.25}
              thickness3={1.25}
              thickness4={1.25}
              hideDataPoints
              hideDataPoints2
              hideDataPoints3
              hideDataPoints4
              noOfSections={sections}
              stepValue={stepValue}
              yAxisOffset={yMin}
              yAxisTextStyle={{ color: colors.muted, fontSize: 10, fontFamily: 'monospace' }}
              yAxisLabelSuffix=""
              formatYLabel={(label) => formatAxisValue(Number(label))}
              xAxisLabelTextStyle={{ color: colors.muted, fontSize: 10, fontFamily: 'monospace' }}
              spacing={(chartWidth - 34) / Math.max(displayHistory.length - 1, 1)}
              initialSpacing={8}
              yAxisColor={colors.border}
              xAxisColor={colors.border}
              rulesColor={colors.grid}
              rulesType="dashed"
              dashWidth={4}
              dashGap={5}
              areaChart
              startFillColor={accent}
              endFillColor={accent}
              startOpacity={0.22}
              endOpacity={0.01}
              isAnimated={false}
            />
          </View>

          <View style={styles.volumeSection} accessibilityLabel="Relativ handelsvolym under den valda perioden">
            <Text style={styles.volumeLabel}>Volym</Text>
            <View style={styles.volumeBars}>
              {volumeBars.map((volume, index) => (
                <View key={`${index}-${volume}`} style={[styles.volumeBarSlot, { height: 34 }]}>
                  <View style={[styles.volumeBar, { height: Math.max(2, (volume / maximumVolume) * 34), backgroundColor: `${accent}99` }]} />
                </View>
              ))}
            </View>
          </View>
        </>
      )}
    </View>
  );
}

interface IndicatorToggleProps {
  active: boolean;
  color: string;
  label: string;
  onPress: () => void;
}

function IndicatorToggle({ active, color, label, onPress }: IndicatorToggleProps) {
  return (
    <HintedTouchable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      accessibilityLabel={`${active ? 'Dölj' : 'Visa'} ${label}`}
      hint={`${active ? 'Döljer' : 'Visar'} ${label}, ett enkelt glidande medelvärde för de senaste ${label.replace('SMA ', '')} handelsdagarna.`}
      style={[styles.indicator, { borderColor: color }, active && styles.indicatorActive]}
      onPress={onPress}
    >
      <Text style={[styles.indicatorText, { color }]}>{label}</Text>
    </HintedTouchable>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingVertical: 16, marginBottom: 24, overflow: 'hidden' },
  priceSummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 16, marginBottom: 14 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  price: { color: colors.text, fontSize: 25, fontFamily: 'monospace', fontWeight: '700' },
  performanceWrap: { alignItems: 'flex-end' },
  performance: { fontSize: 16, fontFamily: 'monospace', fontWeight: '700' },
  performanceSub: { fontSize: 12, fontFamily: 'monospace', marginTop: 4 },
  periodTabs: { paddingHorizontal: 12, gap: 4, marginBottom: 14 },
  periodButton: { minWidth: 42, height: 36, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  periodButtonActive: { backgroundColor: '#2A2A35' },
  periodText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  periodTextActive: { color: colors.text },
  indicatorRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 14 },
  indicator: { minHeight: 30, paddingHorizontal: 10, justifyContent: 'center', borderWidth: 1, borderRadius: 15 },
  indicatorActive: { backgroundColor: '#1E1E28' },
  indicatorText: { fontSize: 12, fontWeight: '700' },
  loading: { height: 250, justifyContent: 'center', alignItems: 'center', gap: 10 },
  loadingText: { color: colors.muted, fontSize: 13 },
  chartWrap: { paddingHorizontal: 8 },
  volumeSection: { paddingHorizontal: 16, marginTop: 8 },
  volumeLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  volumeBars: { height: 34, flexDirection: 'row', alignItems: 'flex-end', gap: 1 },
  volumeBarSlot: { flex: 1, justifyContent: 'flex-end', minWidth: 1 },
  volumeBar: { width: '100%', borderRadius: 1 },
});
