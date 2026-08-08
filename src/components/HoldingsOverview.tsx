import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppLanguage } from '@/components/AppLanguage';
import type { PortfolioSummary } from '@/lib/holdings';
import { portfolioWeight } from '@/lib/holdings';
import { formatPrice } from '@/lib/format';
import { colors } from '@/theme';

interface HoldingsOverviewProps {
  portfolio: PortfolioSummary | null;
}

export function HoldingsOverview({ portfolio }: HoldingsOverviewProps) {
  const { t } = useAppLanguage();

  if (!portfolio || portfolio.positions.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>
          {t('Du har inga registrerade innehav.', 'You have no registered holdings.')}
        </Text>
      </View>
    );
  }

  // Sortera positioner fallande efter vikt
  const sortedPositions = [...portfolio.positions].sort(
    (a, b) => portfolioWeight(b, portfolio) - portfolioWeight(a, portfolio)
  );

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
          <Text style={styles.cardLabel}>{t('Orealiserad Avkastning', 'Unrealized Return')}</Text>
          <Text style={[
            styles.cardValue,
            portfolio.unrealisedAmount > 0 ? styles.positive : portfolio.unrealisedAmount < 0 ? styles.negative : null,
          ]}>
            {portfolio.unrealisedAmount > 0 ? '+' : ''}{formatPrice(portfolio.unrealisedAmount, portfolio.currency, 0)}{' '}
            ({portfolio.unrealisedPercent > 0 ? '+' : ''}{portfolio.unrealisedPercent.toFixed(1)}%)
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('Dagens Utveckling', 'Today\'s Change')}</Text>
          <Text style={[
            styles.cardValue,
            portfolio.dayChangeAmount > 0 ? styles.positive : portfolio.dayChangeAmount < 0 ? styles.negative : null,
          ]}>
            {portfolio.dayChangeAmount > 0 ? '+' : ''}{formatPrice(portfolio.dayChangeAmount, portfolio.currency, 0)}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('Total Risk (Till Stop-Loss)', 'Total Risk (To Stop-Loss)')}</Text>
          <Text style={styles.cardValue}>{formatPrice(portfolio.riskToStopAmount, portfolio.currency, 0)}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>{t('Portföljfördelning', 'Portfolio Distribution')}</Text>
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
    minWidth: 150,
    backgroundColor: colors.bg,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  distribution: {
    gap: 8,
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
