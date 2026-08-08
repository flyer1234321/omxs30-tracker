import React, { useMemo, useState } from 'react';
import { FlatList, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { SignalBadges } from '@/components/SignalBadges';
import { InfoTip } from '@/components/Tooltip';
import { HintedTouchable } from '@/components/HintedTouchable';
import type { StockData, TableColumnId } from '@/types/stock';
import { colors as palette } from '@/theme';
import { useAppLanguage } from '@/components/AppLanguage';

export type { StockData } from '@/types/stock';

// Fargerna kommer fran det gemensamma temat. Tidigare hade den har vyn,
// detaljvyn, grafen och filterpanelen var sin egen palett, med tva olika
// nyanser av gront och rott i samma granssnitt.
const COLORS = {
  bg: palette.bg, surface: palette.surface, surfaceAlt: palette.surfaceAlt, surfaceHover: palette.surfaceHover,
  textPrimary: palette.textPrimary, textSecondary: palette.textSecondary, positive: palette.positive,
  negative: palette.negative, accent: palette.accent,
  gradeA: palette.gradeA.text, gradeB: palette.gradeB.text,
  gradeC: palette.gradeC.text, gradeD: palette.gradeD.text, gradeF: palette.gradeF.text,
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
  labelEn: string;
  flex: number;
  align?: 'flex-start' | 'center' | 'flex-end';
}

const COLUMNS: Record<TableColumnId, ColumnDefinition> = {
  ticker: { id: 'ticker', label: 'Ticker', labelEn: 'Ticker', flex: 1, align: 'flex-start' },
  grade: { id: 'grade', label: 'Rekyl', labelEn: 'Pullback', flex: 0.7, align: 'center' },
  price: { id: 'price', label: 'Pris', labelEn: 'Price', flex: 0.95, align: 'flex-end' },
  change: { id: 'change', label: '% idag', labelEn: '% today', flex: 0.95, align: 'flex-end' },
  rsi: { id: 'rsi', label: 'RSI', labelEn: 'RSI', flex: 0.65, align: 'flex-end' },
  volume: { id: 'volume', label: 'Vol', labelEn: 'Vol', flex: 0.85, align: 'flex-end' },
  pe: { id: 'pe', label: 'P/E', labelEn: 'P/E', flex: 0.7, align: 'flex-end' },
  sma: { id: 'sma', label: 'SMA', labelEn: 'SMA', flex: 0.55, align: 'center' },
  volatility: { id: 'volatility', label: 'Volat.', labelEn: 'Volat.', flex: 0.85, align: 'flex-end' },
  beta: { id: 'beta', label: 'Beta', labelEn: 'Beta', flex: 0.7, align: 'flex-end' },
  drawdown: { id: 'drawdown', label: 'Max DD', labelEn: 'Max DD', flex: 0.8, align: 'flex-end' },
  relativeStrength: { id: 'relativeStrength', label: 'Mot index', labelEn: 'vs index', flex: 0.9, align: 'flex-end' },
  quality: { id: 'quality', label: 'Kvalitet', labelEn: 'Quality', flex: 0.75, align: 'flex-end' },
  trend: { id: 'trend', label: '7d trend', labelEn: '7d trend', flex: 0.9, align: 'center' },
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
    case 'relativeStrength': return item.relativeStrength63 ?? -999;
    case 'quality': return item.quality?.score ?? -1;
    case 'trend': return item.chartHistory.at(-1)?.close ?? -1;
  }
}

export default function ProTableView({ data, visibleColumns, onStockPress, refreshing, onRefresh }: ProTableViewProps) {
  const { language, t } = useAppLanguage();
  const [sortColumn, setSortColumn] = useState<TableColumnId>('grade');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [availableWidth, setAvailableWidth] = useState(0);
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
  const minimumTableWidth = columns.reduce((width, column) => width + (column.id === 'ticker' ? 112 : 68), 0);
  const tableWidth = Math.max(availableWidth, minimumTableWidth);

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
      case 'relativeStrength': {
        const relative = item.relativeStrength63;
        return <Text style={[styles.numeric, relative != null && relative > 0 && styles.positive, relative != null && relative < 0 && styles.negative]}>{relative != null ? `${relative > 0 ? '+' : ''}${relative.toFixed(1)}` : '-'}</Text>;
      }
      case 'quality': {
        const quality = item.quality;
        if (!quality) return <Text style={styles.empty}>-</Text>;
        // Grön först vid 7: ett godtagbart bolag ska inte se ut som ett starkt.
        const color = quality.score >= 7 ? COLORS.positive : quality.score >= 4 ? palette.warningBright : COLORS.negative;
        return <Text style={[styles.numeric, { color }]}>{quality.score.toFixed(0)}</Text>;
      }
      case 'trend': {
        const color = recentHistory.length > 1 && recentHistory.at(-1)! >= recentHistory[0] ? COLORS.positive : COLORS.negative;
        return <Sparkline data={recentHistory} color={color} />;
      }
    }
  };

  return (
    <View
      style={styles.container}
      onLayout={({ nativeEvent }) => {
        const nextWidth = Math.round(nativeEvent.layout.width);
        setAvailableWidth((currentWidth) => currentWidth === nextWidth ? currentWidth : nextWidth);
      }}
    >
      <ScrollView horizontal style={styles.horizontalScroll} contentContainerStyle={styles.horizontalScrollContent} showsHorizontalScrollIndicator={false}>
        <View style={[styles.table, { width: tableWidth }]}>
          <View style={styles.headerRow}>
            {columns.map((column) => (
              <InfoTip
                key={column.id}
                term={column.id}
                style={[styles.headerCell, { flex: column.flex, alignItems: column.align }]}
                onPress={() => handleSort(column.id)}
                accessibilityLabel={`${t('Sortera efter', 'Sort by')} ${language === 'en' ? column.labelEn : column.label}`}
              >
                <Text style={[styles.headerText, { textAlign: column.align === 'flex-start' ? 'left' : column.align === 'center' ? 'center' : 'right' }]}>
                  {language === 'en' ? column.labelEn : column.label}{sortColumn === column.id ? ` ${sortDirection === 'asc' ? '▲' : '▼'}` : ''}
                </Text>
              </InfoTip>
            ))}
          </View>
          <FlatList
            data={sortedData}
            keyExtractor={(item) => item.ticker}
            renderItem={({ item, index }) => <HintedTouchable style={[styles.row, index % 2 === 0 ? styles.rowEven : styles.rowOdd]} onPress={() => onStockPress(item.ticker)} accessibilityLabel={`${t('Öppna analys för', 'Open analysis for')} ${item.companyName}`} hint={t(`Öppnar detaljvyn för ${item.ticker.replace('.ST', '')} med nyckeltal, graf och analys.`, `Opens the detail view for ${item.ticker.replace('.ST', '')} with metrics, chart and analysis.`)}>{columns.map((column) => <View key={column.id} style={[styles.cell, { flex: column.flex, alignItems: column.align }]}>{renderCell(item, column.id)}</View>)}</HintedTouchable>}
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
  headerCell: { justifyContent: 'center' }, headerText: { color: COLORS.textSecondary, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  row: { flexDirection: 'row', minHeight: 54, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.surfaceAlt, alignItems: 'center' },
  rowEven: { backgroundColor: COLORS.surface }, rowOdd: { backgroundColor: COLORS.surfaceAlt }, cell: { justifyContent: 'center' },
  tickerText: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },
  numeric: { color: COLORS.textPrimary, fontSize: 12, fontVariant: ['tabular-nums'], ...Platform.select({ ios: { fontFamily: 'Menlo' }, android: { fontFamily: 'monospace' } }) },
  positive: { color: COLORS.positive }, negative: { color: COLORS.negative }, warning: { color: palette.warningBright }, sma: { fontSize: 14, fontWeight: '700' }, empty: { color: COLORS.textSecondary, fontSize: 12 },
  gradeBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }, gradeText: { fontSize: 12, fontWeight: '700' },
});
