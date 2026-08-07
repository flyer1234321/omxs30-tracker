import React, { useMemo, useState } from 'react';
import { FlatList, Platform, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { SignalBadges } from '@/components/SignalBadges';
import { HintedTouchable } from '@/components/HintedTouchable';
import { InfoTooltip } from '@/components/InfoTooltip';
import type { StockData, TableColumnId } from '@/types/stock';

export type { StockData } from '@/types/stock';

const COLORS = {
  bg: '#08080f', surface: '#111118', surfaceAlt: '#161620', surfaceHover: '#1c1c28',
  textPrimary: '#e2e2ea', textSecondary: '#6b6b82', positive: '#22c55e',
  negative: '#ef4444', accent: '#3b82f6', gradeA: '#22c55e', gradeB: '#84cc16',
  gradeC: '#eab308', gradeD: '#f97316', gradeF: '#ef4444',
};

interface ProTableViewProps {
  data: StockData[];
  visibleColumns: TableColumnId[];
  onStockPress: (ticker: string) => void;
  refreshing: boolean;
  onRefresh: () => void;
}

interface ColumnDefinition {
  id: TableColumnId;
  label: string;
  flex: number;
  align?: 'flex-start' | 'center' | 'flex-end';
  hint: string;
}

const COLUMNS: Record<TableColumnId, ColumnDefinition> = {
  ticker: { id: 'ticker', label: 'Ticker', flex: 1.55, align: 'flex-start', hint: 'Aktiesymbolen. Klicka på raden för att öppna hela analysen.' },
  grade: { id: 'grade', label: 'Betyg', flex: 0.65, align: 'center', hint: 'Appens samlade hälsobetyg A till F. Betyget är beslutsstöd, inte ett köpråd.' },
  price: { id: 'price', label: 'Pris', flex: 0.95, align: 'flex-end', hint: 'Senast tillgängliga aktiekurs i lokal handelsvaluta.' },
  change: { id: 'change', label: '% idag', flex: 0.95, align: 'flex-end', hint: 'Procentuell kursförändring under den aktuella handelsdagen.' },
  rsi: { id: 'rsi', label: 'RSI', flex: 0.65, align: 'flex-end', hint: 'RSI över 70 kan indikera överköpt och under 30 översålt, men är ingen garanti för vändning.' },
  volume: { id: 'volume', label: 'Vol', flex: 0.85, align: 'flex-end', hint: 'Senaste handelsvolym jämfört med 20-dagarssnittet. 2,0x betyder dubbelt snittvolym.' },
  pe: { id: 'pe', label: 'P/E', flex: 0.7, align: 'flex-end', hint: 'Pris dividerat med vinst per aktie. Lägre är inte automatiskt bättre.' },
  sma: { id: 'sma', label: 'SMA', flex: 0.55, align: 'center', hint: 'Pilen visar om kursen ligger över eller under SMA 125, cirka ett halvårssnitt.' },
  volatility: { id: 'volatility', label: 'Volat.', flex: 0.85, align: 'flex-end', hint: 'Årsomräknad volatilitet från de senaste 20 handelsdagarna. Högre värde betyder större historiska rörelser.' },
  beta: { id: 'beta', label: 'Beta', flex: 0.7, align: 'flex-end', hint: 'Hur mycket aktien historiskt rört sig relativt sitt jämförelseindex. 1,0 motsvarar ungefär indexrörelsen.' },
  drawdown: { id: 'drawdown', label: 'Max DD', flex: 0.8, align: 'flex-end', hint: 'Största historiska nedgång från en tidigare topp inom det tillgängliga kursunderlaget.' },
  riskReward: { id: 'riskReward', label: 'R/R', flex: 0.65, align: 'flex-end', hint: 'Intern poäng 0 till 100 som väger trend, volatilitet och hälsobetyg. Den är ett filter, inte en prognos.' },
  trend: { id: 'trend', label: '7d trend', flex: 0.9, align: 'center', hint: 'Mini-graf över de senaste sju dagarnas tillgängliga kursrörelser.' },
};

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const width = 60;
  const height = 24;
  const min = Math.min(...data);
  const range = Math.max(Math.max(...data) - min, 1);
  const points = data.map((value, index) => `${(index / (data.length - 1)) * width},${height - ((value - min) / range) * height}`).join(' ');
  return <Svg width={width} height={height}><Polyline points={points} fill="none" stroke={color} strokeWidth={1.5} /></Svg>;
}

function gradeColor(grade?: 'A' | 'B' | 'C' | 'D' | 'F') {
  return ({ A: COLORS.gradeA, B: COLORS.gradeB, C: COLORS.gradeC, D: COLORS.gradeD, F: COLORS.gradeF } as Record<string, string>)[String(grade)] ?? COLORS.textSecondary;
}

function sortValue(item: StockData, column: TableColumnId): number | string {
  switch (column) {
    case 'ticker': return item.ticker;
    case 'grade': return item.healthCheck?.gradeScore ?? -1;
    case 'price': return item.currentPrice;
    case 'change': return item.regularMarketChangePercent ?? 0;
    case 'rsi': return item.rsi ?? -1;
    case 'volume': return item.latestVolume && item.avgVolume20 ? item.latestVolume / item.avgVolume20 : -1;
    case 'pe': return item.trailingPE ?? -1;
    case 'sma': return item.sma125 ? item.currentPrice / item.sma125 : -1;
    case 'volatility': return item.volatility ?? -1;
    case 'beta': return item.beta ?? -1;
    case 'drawdown': return item.maxDrawdown ?? -1;
    case 'riskReward': return item.riskRewardScore ?? -1;
    case 'trend': return item.chartHistory.at(-1)?.close ?? -1;
  }
}

export default function ProTableView({ data, visibleColumns, onStockPress, refreshing, onRefresh }: ProTableViewProps) {
  const [sortColumn, setSortColumn] = useState<TableColumnId>('grade');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const { width: viewportWidth } = useWindowDimensions();
  const columns = useMemo(() => {
    const unique = Array.from(new Set(['ticker', ...visibleColumns] as TableColumnId[]));
    return unique.map((id) => COLUMNS[id]).filter(Boolean);
  }, [visibleColumns]);
  const sortedData = useMemo(() => [...data].sort((a, b) => {
    const aValue = sortValue(a, sortColumn);
    const bValue = sortValue(b, sortColumn);
    const comparison = typeof aValue === 'string' && typeof bValue === 'string'
      ? aValue.localeCompare(bValue)
      : Number(aValue) - Number(bValue);
    return sortDirection === 'asc' ? comparison : -comparison;
  }), [data, sortColumn, sortDirection]);
  const tableWidth = Math.max(viewportWidth, columns.reduce((width, column) => width + (column.id === 'ticker' ? 120 : 68), 0));

  const handleSort = (column: TableColumnId) => {
    if (column === sortColumn) setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc');
    else { setSortColumn(column); setSortDirection('desc'); }
  };

  const renderCell = (item: StockData, column: TableColumnId) => {
    const change = item.regularMarketChangePercent ?? 0;
    const volumeRatio = item.latestVolume != null && item.avgVolume20 != null && item.avgVolume20 > 0 ? item.latestVolume / item.avgVolume20 : null;
    const recentHistory = item.chartHistory.slice(-7).map((point) => point.close);

    switch (column) {
      case 'ticker':
        return <View><Text style={styles.tickerText} numberOfLines={1}>{item.ticker.replace('.ST', '')}</Text><SignalBadges signals={item.signals} /></View>;
      case 'grade': {
        const grade = item.healthCheck?.grade;
        const color = gradeColor(grade);
        return grade ? <View style={[styles.gradeBadge, { backgroundColor: `${color}20` }]}><Text style={[styles.gradeText, { color }]}>{grade}</Text></View> : <Text style={styles.empty}>-</Text>;
      }
      case 'price': return <Text style={styles.numeric}>{item.currentPrice.toFixed(2)}</Text>;
      case 'change': return <Text style={[styles.numeric, change > 0 && styles.positive, change < 0 && styles.negative]}>{change > 0 ? '▲ ' : change < 0 ? '▼ ' : ''}{Math.abs(change).toFixed(2)}%</Text>;
      case 'rsi': return <Text style={[styles.numeric, item.rsi != null && item.rsi < 30 && styles.positive, item.rsi != null && item.rsi > 70 && styles.negative]}>{item.rsi != null ? Math.round(item.rsi) : '-'}</Text>;
      case 'volume': return <Text style={[styles.numeric, volumeRatio != null && volumeRatio >= 2 && styles.warning]}>{volumeRatio != null ? `${volumeRatio.toFixed(1)}x` : '-'}</Text>;
      case 'pe': return <Text style={styles.numeric}>{item.trailingPE != null ? item.trailingPE.toFixed(1) : '-'}</Text>;
      case 'sma': return <Text style={[styles.sma, item.sma125 != null && item.currentPrice > item.sma125 ? styles.positive : styles.negative]}>{item.sma125 == null ? '-' : item.currentPrice > item.sma125 ? '↑' : '↓'}</Text>;
      case 'volatility': return <Text style={[styles.numeric, item.volatility != null && item.volatility > 35 && styles.warning]}>{item.volatility != null ? `${item.volatility.toFixed(0)}%` : '-'}</Text>;
      case 'beta': return <Text style={styles.numeric}>{item.beta != null ? item.beta.toFixed(2) : '-'}</Text>;
      case 'drawdown': return <Text style={[styles.numeric, item.maxDrawdown != null && styles.negative]}>{item.maxDrawdown != null ? `-${item.maxDrawdown.toFixed(1)}%` : '-'}</Text>;
      case 'riskReward': return <Text style={[styles.numeric, item.riskRewardScore != null && item.riskRewardScore >= 70 && styles.positive]}>{item.riskRewardScore != null ? item.riskRewardScore.toFixed(0) : '-'}</Text>;
      case 'trend': {
        const color = recentHistory.length > 1 && recentHistory.at(-1)! >= recentHistory[0] ? COLORS.positive : COLORS.negative;
        return <Sparkline data={recentHistory} color={color} />;
      }
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal style={styles.horizontalScroll} contentContainerStyle={styles.horizontalScrollContent} showsHorizontalScrollIndicator={false}>
        <View style={[styles.table, { width: tableWidth }]}>
          <View style={styles.headerRow}>
            {columns.map((column) => (
              <View key={column.id} style={[styles.headerCell, { flex: column.flex, alignItems: column.align }]}>
                <HintedTouchable
                  style={styles.headerSortButton}
                  onPress={() => handleSort(column.id)}
                  accessibilityLabel={`Sortera efter ${column.label}`}
                  hint={`Sortera tabellen efter ${column.label}. ${column.hint}`}
                >
                  <Text style={[styles.headerText, { textAlign: column.align === 'flex-start' ? 'left' : column.align === 'center' ? 'center' : 'right' }]}>
                    {column.label}{sortColumn === column.id ? ` ${sortDirection === 'asc' ? '▲' : '▼'}` : ''}
                  </Text>
                </HintedTouchable>
                <View style={styles.headerInfo}>
                  <InfoTooltip label={column.label} description={`${column.hint} Klicka på rubriken för att sortera.`} align={column.align === 'flex-start' ? 'left' : 'right'} />
                </View>
              </View>
            ))}
          </View>
          <FlatList
            data={sortedData}
            keyExtractor={(item) => item.ticker}
            renderItem={({ item, index }) => <HintedTouchable style={[styles.row, index % 2 === 0 ? styles.rowEven : styles.rowOdd]} onPress={() => onStockPress(item.ticker)} accessibilityLabel={`Öppna analys för ${item.companyName}`} hint={`Öppnar detaljvyn för ${item.ticker.replace('.ST', '')} med nyckeltal, graf och analys.`}>{columns.map((column) => <View key={column.id} style={[styles.cell, { flex: column.flex, alignItems: column.align }]}>{renderCell(item, column.id)}</View>)}</HintedTouchable>}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.textPrimary} colors={[COLORS.accent]} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg }, horizontalScroll: { flex: 1 }, horizontalScrollContent: { flexGrow: 1 }, table: { flex: 1 }, listContent: { paddingBottom: 20 },
  headerRow: { flexDirection: 'row', backgroundColor: COLORS.surfaceHover, paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceAlt },
  headerCell: { justifyContent: 'center', position: 'relative', minHeight: 18 },
  headerSortButton: { width: '100%', paddingRight: 18 },
  headerInfo: { position: 'absolute', right: 0, top: 1 },
  headerText: { color: COLORS.textSecondary, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  row: { flexDirection: 'row', minHeight: 54, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.surfaceAlt, alignItems: 'center' },
  rowEven: { backgroundColor: COLORS.surface }, rowOdd: { backgroundColor: COLORS.surfaceAlt }, cell: { justifyContent: 'center' },
  tickerText: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },
  numeric: { color: COLORS.textPrimary, fontSize: 12, fontVariant: ['tabular-nums'], ...Platform.select({ ios: { fontFamily: 'Menlo' }, android: { fontFamily: 'monospace' } }) },
  positive: { color: COLORS.positive }, negative: { color: COLORS.negative }, warning: { color: '#fbbf24' }, sma: { fontSize: 14, fontWeight: '700' }, empty: { color: COLORS.textSecondary, fontSize: 12 },
  gradeBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }, gradeText: { fontSize: 12, fontWeight: '700' },
});
