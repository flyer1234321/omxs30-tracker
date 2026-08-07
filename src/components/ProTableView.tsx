import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

const COLORS = {
  bg: '#08080f',
  surface: '#111118',
  surfaceAlt: '#161620',
  surfaceHover: '#1c1c28',
  textPrimary: '#e2e2ea',
  textSecondary: '#6b6b82',
  positive: '#22c55e',
  negative: '#ef4444',
  accent: '#3b82f6',
  gradeA: '#22c55e',
  gradeB: '#84cc16',
  gradeC: '#eab308',
  gradeD: '#f97316',
  gradeF: '#ef4444',
};

// Extracted from app/index.tsx
interface ChartDataPoint {
  date: string;
  close: number;
  sma125?: number;
}

interface ChecklistItem {
  label: string;
  passed: boolean;
  detail: string;
}

interface HealthCheck {
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  gradeScore: number;
  summary: string;
  riskLevel: 'Låg' | 'Medel' | 'Hög';
  momentum: 'Uppåt' | 'Nedåt' | 'Sidledes';
  checklist: ChecklistItem[];
}

export interface StockData {
  ticker: string;
  companyName: string;
  currentPrice: number;
  sma125: number | null;
  sma200: number | null;
  rsi: number | null;
  diffPercent125: number | null;
  chartHistory: ChartDataPoint[];
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  trailingPE: number | null;
  dividendYield: number | null;
  marketCap: number | null;
  regularMarketChangePercent: number | null;
  latestVolume: number | null;
  avgVolume20: number | null;
  healthCheck: HealthCheck | null;
}

interface ProTableViewProps {
  data: StockData[];
  onStockPress: (ticker: string) => void;
  refreshing: boolean;
  onRefresh: () => void;
}

type SortColumn = 'ticker' | 'grade' | 'price' | 'change' | 'rsi' | 'pe' | 'sma' | 'volume' | 'trend';
type SortDirection = 'asc' | 'desc';

const Sparkline = ({
  data,
  width = 60,
  height = 24,
  color,
}: {
  data: number[];
  width?: number;
  height?: number;
  color: string;
}) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map(
      (v, i) =>
        `${(i / (data.length - 1)) * width},${
          height - ((v - min) / range) * height
        }`
    )
    .join(' ');
  return (
    <Svg width={width} height={height}>
      <Polyline points={points} fill="none" stroke={color} strokeWidth={1.5} />
    </Svg>
  );
};

export default function ProTableView({
  data,
  onStockPress,
  refreshing,
  onRefresh,
}: ProTableViewProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('grade');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      let aVal: any = 0;
      let bVal: any = 0;

      switch (sortColumn) {
        case 'ticker':
          aVal = a.ticker;
          bVal = b.ticker;
          break;
        case 'grade':
          aVal = a.healthCheck?.gradeScore ?? -1;
          bVal = b.healthCheck?.gradeScore ?? -1;
          break;
        case 'price':
          aVal = a.currentPrice;
          bVal = b.currentPrice;
          break;
        case 'change':
          aVal = a.regularMarketChangePercent ?? 0;
          bVal = b.regularMarketChangePercent ?? 0;
          break;
        case 'rsi':
          aVal = a.rsi ?? 0;
          bVal = b.rsi ?? 0;
          break;
        case 'pe':
          aVal = a.trailingPE ?? 0;
          bVal = b.trailingPE ?? 0;
          break;
        case 'sma':
          aVal = a.sma125 ? (a.currentPrice > a.sma125 ? 1 : -1) : 0;
          bVal = b.sma125 ? (b.currentPrice > b.sma125 ? 1 : -1) : 0;
          break;
        case 'volume':
          aVal = (a.latestVolume && a.avgVolume20) ? a.latestVolume / a.avgVolume20 : 0;
          bVal = (b.latestVolume && b.avgVolume20) ? b.latestVolume / b.avgVolume20 : 0;
          break;
        default:
          break;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortColumn, sortDirection]);

  const renderSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) return null;
    return <Text style={styles.sortIcon}>{sortDirection === 'asc' ? '▲' : '▼'}</Text>;
  };

  const renderHeader = () => (
    <View style={styles.headerRow}>
      <TouchableOpacity
        style={[styles.headerCell, { flex: 1.2 }]}
        onPress={() => handleSort('ticker')}
      >
        <Text style={[styles.headerText, { textAlign: 'left' }]}>
          Ticker {renderSortIcon('ticker')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.headerCell, { flex: 0.8 }]}
        onPress={() => handleSort('grade')}
      >
        <Text style={[styles.headerText, { textAlign: 'center' }]}>
          Betyg {renderSortIcon('grade')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.headerCell, { flex: 1 }]}
        onPress={() => handleSort('price')}
      >
        <Text style={[styles.headerText, { textAlign: 'right' }]}>
          Pris {renderSortIcon('price')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.headerCell, { flex: 1 }]}
        onPress={() => handleSort('change')}
      >
        <Text style={[styles.headerText, { textAlign: 'right' }]}>
          %Idag {renderSortIcon('change')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.headerCell, { flex: 0.8 }]}
        onPress={() => handleSort('rsi')}
      >
        <Text style={[styles.headerText, { textAlign: 'right' }]}>
          RSI {renderSortIcon('rsi')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.headerCell, { flex: 0.8 }]}
        onPress={() => handleSort('volume')}
      >
        <Text style={[styles.headerText, { textAlign: 'right' }]}>
          Vol {renderSortIcon('volume')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.headerCell, { flex: 0.7 }]}
        onPress={() => handleSort('pe')}
      >
        <Text style={[styles.headerText, { textAlign: 'right' }]}>
          P/E {renderSortIcon('pe')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.headerCell, { flex: 0.6 }]}
        onPress={() => handleSort('sma')}
      >
        <Text style={[styles.headerText, { textAlign: 'center' }]}>
          SMA {renderSortIcon('sma')}
        </Text>
      </TouchableOpacity>
      <View style={[styles.headerCell, { flex: 0.9 }]}>
        <Text style={[styles.headerText, { textAlign: 'center' }]}>7d Trend</Text>
      </View>
    </View>
  );

  const getGradeColor = (grade: string | undefined) => {
    switch (grade) {
      case 'A':
        return COLORS.gradeA;
      case 'B':
        return COLORS.gradeB;
      case 'C':
        return COLORS.gradeC;
      case 'D':
        return COLORS.gradeD;
      case 'F':
        return COLORS.gradeF;
      default:
        return COLORS.textSecondary;
    }
  };

  const renderItem = ({ item, index }: { item: StockData; index: number }) => {
    const isEven = index % 2 === 0;
    const shortTicker = item.ticker.replace('.ST', '');
    const grade = item.healthCheck?.grade;
    const gradeColor = getGradeColor(grade);

    const change = item.regularMarketChangePercent ?? 0;
    const isPositiveChange = change > 0;
    const isNegativeChange = change < 0;

    const rsi = item.rsi;
    let rsiColor = COLORS.textSecondary;
    if (rsi) {
      if (rsi > 70) rsiColor = COLORS.red;
      else if (rsi < 30) rsiColor = COLORS.green;
    }

    const volRatio = (item.latestVolume && item.avgVolume20) ? (item.latestVolume / item.avgVolume20) * 100 : 0;

    let smaStatus = '-';
    let smaColor = COLORS.textSecondary;
    if (item.sma125) {
      if (item.currentPrice > item.sma125) {
        smaStatus = '↑';
        smaColor = COLORS.positive;
      } else {
        smaStatus = '↓';
        smaColor = COLORS.negative;
      }
    }

    // Get last 7 days for sparkline
    const history = item.chartHistory || [];
    const recentHistory = history.slice(-7).map((p) => p.close);
    let sparklineColor = COLORS.textSecondary;
    if (recentHistory.length >= 2) {
      const first = recentHistory[0];
      const last = recentHistory[recentHistory.length - 1];
      sparklineColor = last > first ? COLORS.positive : COLORS.negative;
    }

    return (
      <TouchableOpacity
        style={[
          styles.row,
          isEven ? styles.rowEven : styles.rowOdd,
        ]}
        onPress={() => onStockPress(item.ticker)}
      >
        <View style={[styles.cell, { flex: 1.2, alignItems: 'flex-start' }]}>
          <Text style={styles.tickerText} numberOfLines={1}>
            {shortTicker}
          </Text>
        </View>

        <View style={[styles.cell, { flex: 0.8, alignItems: 'center' }]}>
          {grade ? (
            <View style={[styles.badge, { backgroundColor: gradeColor + '20' }]}>
              <Text style={[styles.badgeText, { color: gradeColor }]}>{grade}</Text>
            </View>
          ) : (
            <Text style={styles.emptyText}>-</Text>
          )}
        </View>

        <View style={[styles.cell, { flex: 1, alignItems: 'flex-end' }]}>
          <Text style={styles.numericText}>{item.currentPrice.toFixed(2)}</Text>
        </View>

        <View style={[styles.cell, { flex: 1, alignItems: 'flex-end' }]}>
          <Text
            style={[
              styles.numericText,
              isPositiveChange && styles.textPositive,
              isNegativeChange && styles.textNegative,
            ]}
          >
            {isPositiveChange && '▲ '}
            {isNegativeChange && '▼ '}
            {Math.abs(change).toFixed(2)}%
          </Text>
        </View>

        <View style={[styles.cell, { flex: 0.8, alignItems: 'flex-end' }]}>
          <Text style={[styles.numericText, { color: rsiColor }]}>
            {rsi ? Math.round(rsi) : '-'}
          </Text>
        </View>

        <View style={[styles.cell, { flex: 0.8, alignItems: 'flex-end' }]}>
          {volRatio > 150 ? (
            <View style={[styles.badge, { backgroundColor: '#FFD70030', paddingHorizontal: 4 }]}>
              <Text style={[styles.numericText, { color: '#FFD700' }]}>{Math.round(volRatio)}%</Text>
            </View>
          ) : (
            <Text style={styles.numericText}>
              {volRatio > 0 ? `${Math.round(volRatio)}%` : '-'}
            </Text>
          )}
        </View>

        <View style={[styles.cell, { flex: 0.7, alignItems: 'flex-end' }]}>
          <Text style={styles.numericText}>
            {item.trailingPE ? item.trailingPE.toFixed(1) : '-'}
          </Text>
        </View>

        <View style={[styles.cell, { flex: 0.6, alignItems: 'center' }]}>
          <Text style={[styles.smaText, { color: smaColor }]}>{smaStatus}</Text>
        </View>

        <View style={[styles.cell, { flex: 0.9, alignItems: 'center' }]}>
          {recentHistory.length >= 2 ? (
            <Sparkline data={recentHistory} color={sparklineColor} />
          ) : (
            <Text style={styles.emptyText}>-</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {renderHeader()}
      <FlatList
        data={sortedData}
        keyExtractor={(item) => item.ticker}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.textPrimary}
            colors={[COLORS.accent]}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  listContent: {
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceHover,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceAlt,
  },
  headerCell: {
    justifyContent: 'center',
  },
  headerText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sortIcon: {
    fontSize: 8,
    marginLeft: 2,
    color: COLORS.textSecondary,
  },
  row: {
    flexDirection: 'row',
    height: 48,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.surfaceAlt,
    alignItems: 'center',
  },
  rowEven: {
    backgroundColor: COLORS.surface,
  },
  rowOdd: {
    backgroundColor: COLORS.surfaceAlt,
  },
  cell: {
    justifyContent: 'center',
  },
  tickerText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  numericText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    ...Platform.select({
      ios: { fontFamily: 'Menlo' },
      android: { fontFamily: 'monospace' },
    }),
  },
  textPositive: {
    color: COLORS.positive,
  },
  textNegative: {
    color: COLORS.negative,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  smaText: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
});
