import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { useAppLanguage } from '@/components/AppLanguage';
import type { PortfolioSummary } from '@/lib/holdings';
import { portfolioWeight, approximateSekValue } from '@/lib/holdings';
import { formatPrice, formatSignedPercent } from '@/lib/format';
import { colors } from '@/theme';
import type { StockData, ChartDataPoint } from '@/types/stock';

interface HoldingsOverviewProps {
  portfolio: PortfolioSummary | null;
  data?: StockData[];
}

function getHistoricalPrice(chartHistory: ChartDataPoint[], targetDate: Date): number | null {
  if (!chartHistory || chartHistory.length === 0) return null;
  const targetTime = targetDate.getTime();
  let closest: ChartDataPoint | null = null;
  for (const point of chartHistory) {
    const time = new Date(point.date).getTime();
    if (time <= targetTime) {
      closest = point;
    } else {
      break;
    }
  }
  return closest ? closest.close : null;
}

function calculateHistoricalReturn(portfolio: PortfolioSummary, data: StockData[] | undefined, daysBack: number) {
  if (!data || portfolio.positions.length === 0) return null;
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - daysBack);

  let historicalTotalSek = 0;
  let currentTotalSek = 0;

  for (const position of portfolio.positions) {
    const stock = data.find((s) => s.ticker === position.ticker);
    if (!stock) continue;
    const histPrice = getHistoricalPrice(stock.chartHistory, targetDate);
    if (histPrice != null) {
      historicalTotalSek += approximateSekValue(histPrice * position.shares, position.currency);
      currentTotalSek += approximateSekValue(position.marketValue, position.currency);
    }
  }

  if (historicalTotalSek === 0) return null;
  const amountChange = currentTotalSek - historicalTotalSek;
  const percentChange = (amountChange / historicalTotalSek) * 100;
  return { amount: amountChange, percent: percentChange };
}

export function HoldingsOverview({ portfolio, data }: HoldingsOverviewProps) {
  const { t } = useAppLanguage();
  const [isExpanded, setIsExpanded] = useState(true);
  
  const horizons = ['today', '1m', '1y', 'total'] as const;
  const [horizonIndex, setHorizonIndex] = useState(0);
  const horizon = horizons[horizonIndex];

  if (!portfolio || portfolio.positions.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>
          {t('Du har inga registrerade innehav.', 'You have no registered holdings.')}
        </Text>
      </View>
    );
  }

  const sortedPositions = [...portfolio.positions].sort(
    (a, b) => portfolioWeight(b, portfolio) - portfolioWeight(a, portfolio)
  );

  let returnLabel = t('Dagens Utveckling', 'Today\'s Change');
  let returnAmount: number | null = portfolio.dayChangeAmount;
  let returnPercent: number | null = null;

  if (horizon === 'total') {
    returnLabel = t('Sedan inköp', 'Since purchase');
    returnAmount = portfolio.unrealisedAmount;
    returnPercent = portfolio.unrealisedPercent;
  } else if (horizon === '1m') {
    returnLabel = t('Utveckling (1 månad)', 'Return (1 month)');
    const hist = calculateHistoricalReturn(portfolio, data, 30);
    if (hist) { returnAmount = hist.amount; returnPercent = hist.percent; }
  } else if (horizon === '1y') {
    returnLabel = t('Utveckling (1 år)', 'Return (1 year)');
    const hist = calculateHistoricalReturn(portfolio, data, 365);
    if (hist) { returnAmount = hist.amount; returnPercent = hist.percent; }
  }

  return (
    <View style={styles.container}>
      <View style={styles.summaryGrid}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('Totalt Värde', 'Total Value')}</Text>
          <Text style={styles.cardValue}>{formatPrice(portfolio.marketValue, portfolio.currency, 0)}</Text>
          {portfolio.mixedCurrencies && (
            <Text style={styles.cardWarning}>
              {t('Visas i SEK (omräknat med schablonkurser)', 'Shown in SEK (converted with standard rates)')}
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('Investerat', 'Invested')}</Text>
          <Text style={styles.cardValue}>{formatPrice(portfolio.costBasis, portfolio.currency, 0)}</Text>
        </View>

        <Pressable 
          style={[styles.card, styles.interactiveCard]} 
          onPress={() => setHorizonIndex((i) => (i + 1) % horizons.length)}
          accessibilityRole="button"
        >
          <Text style={styles.cardLabel}>{returnLabel} ▾</Text>
          <Text style={[
            styles.cardValue,
            (returnAmount ?? 0) > 0 ? styles.positive : (returnAmount ?? 0) < 0 ? styles.negative : null,
          ]}>
            {(returnAmount ?? 0) > 0 ? '+' : ''}{formatPrice(returnAmount, portfolio.currency, 0)}
            {returnPercent != null ? ` (${returnPercent > 0 ? '+' : ''}${returnPercent.toFixed(1)}%)` : ''}
          </Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('Total Risk (Till Stop-Loss)', 'Total Risk (To Stop-Loss)')}</Text>
          <Text style={styles.cardValue}>{formatPrice(portfolio.riskToStopAmount, portfolio.currency, 0)}</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.sectionHeader} 
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.7}
      >
        <Text style={styles.sectionTitle}>{t('Portföljfördelning', 'Portfolio Distribution')}</Text>
        <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
      </TouchableOpacity>
      
      {isExpanded && (
        <ScrollView style={styles.distributionScroll} showsVerticalScrollIndicator={true}>
          <View style={styles.distribution}>
            {sortedPositions.map((pos) => {
              const weight = portfolioWeight(pos, portfolio);
              const isConcentrated = weight > 25;
              return (
                <View key={pos.ticker} style={styles.barRow}>
                  <Text style={styles.barLabel}>{pos.ticker}</Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${Math.max(1, Math.min(100, weight))}%` },
                        isConcentrated ? { backgroundColor: colors.warning } : null,
                      ]}
                    />
                  </View>
                  <Text style={styles.barValue}>{weight.toFixed(1)}%</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 12,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
    padding: 24,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  card: {
    flex: 1,
    minWidth: '40%',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  interactiveCard: {
    borderColor: colors.accent,
  },
  cardLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  cardWarning: {
    fontSize: 12,
    color: colors.warning,
    marginTop: 4,
  },
  positive: {
    color: colors.positive,
  },
  negative: {
    color: colors.negative,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  expandIcon: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  distributionScroll: {
    maxHeight: 150,
  },
  distribution: {
    gap: 8,
    paddingBottom: 8,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  barLabel: {
    width: 60,
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.bg,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 4,
  },
  barValue: {
    width: 45,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'right',
  },
});
