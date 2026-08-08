import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { calculateDataCoverage } from '@/lib/analyst-engine';
import { getBearPoints, getBullPoints } from '@/lib/stock-insights';
import { assessValuation, type ValuationTone } from '@/lib/valuation';
import { colors } from '@/theme';
import type { StockData } from '@/types/stock';
import { useAppLanguage } from '@/components/AppLanguage';
import type { AppLanguage } from '@/lib/language';

type AxisTone = ValuationTone;

interface AxisResult {
  label: string;
  value: string;
  detail: string;
  tone: AxisTone;
}

function qualityAxis(stock: StockData, language: AppLanguage): AxisResult {
  const en = language === 'en';
  if (!stock.quality) return { label: en ? 'Company quality' : 'Bolagskvalitet', value: en ? 'No data' : 'Saknar data', detail: en ? 'Too few reported metrics for a fair assessment.' : 'För få rapportmått för en rättvis bedömning.', tone: 'unknown' };
  const tone: AxisTone = stock.quality.score >= 7 ? 'positive' : stock.quality.score < 4 ? 'negative' : 'neutral';
  return {
    label: en ? 'Company quality' : 'Bolagskvalitet',
    value: `${en ? (stock.quality.score >= 7 ? 'Strong' : stock.quality.score < 4 ? 'Weak' : 'Mixed') : stock.quality.label} · ${stock.quality.score.toFixed(0)}/10`,
    detail: en ? 'Debt, profitability, cash flow and growth from the latest report.' : 'Skuld, lönsamhet, kassaflöde och tillväxt från senaste rapport.',
    tone,
  };
}

function trendAxis(stock: StockData, language: AppLanguage): AxisResult {
  const en = language === 'en';
  const comparisons = [stock.sma125, stock.sma200].filter((value): value is number => value != null);
  if (!comparisons.length) return { label: 'Trend', value: en ? 'No data' : 'Saknar data', detail: en ? 'Moving averages are unavailable.' : 'Glidande medelvärden saknas.', tone: 'unknown' };
  const above = comparisons.filter((average) => stock.currentPrice > average).length;
  if (above === comparisons.length) return { label: 'Trend', value: en ? 'Positive' : 'Positiv', detail: en ? 'The price is above the available longer-term averages.' : 'Kursen ligger över tillgängliga längre kurssnitt.', tone: 'positive' };
  if (above === 0) return { label: 'Trend', value: en ? 'Negative' : 'Negativ', detail: en ? 'The price is below the available longer-term averages.' : 'Kursen ligger under tillgängliga längre kurssnitt.', tone: 'negative' };
  return { label: 'Trend', value: en ? 'Mixed' : 'Blandad', detail: en ? 'The longer-term averages give mixed signals.' : 'De längre kurssnitten ger olika besked.', tone: 'neutral' };
}

function riskAxis(stock: StockData, language: AppLanguage): AxisResult {
  const en = language === 'en';
  const hasData = stock.volatility != null || stock.maxDrawdown != null || stock.beta != null;
  if (!hasData) return { label: en ? 'Historical risk' : 'Historisk risk', value: en ? 'No data' : 'Saknar data', detail: en ? 'Volatility, drawdown and beta are unavailable.' : 'Volatilitet, drawdown och beta saknas.', tone: 'unknown' };
  const high = (stock.volatility ?? 0) > 40 || (stock.maxDrawdown ?? 0) > 35 || (stock.beta ?? 0) > 1.5;
  const low = stock.volatility != null && stock.volatility <= 25
    && stock.maxDrawdown != null && stock.maxDrawdown <= 20
    && (stock.beta == null || stock.beta <= 1.2);
  if (high) return { label: en ? 'Historical risk' : 'Historisk risk', value: en ? 'High' : 'Hög', detail: en ? 'At least one risk metric shows large historical moves.' : 'Minst ett riskmått visar stora historiska rörelser.', tone: 'negative' };
  if (low) return { label: en ? 'Historical risk' : 'Historisk risk', value: en ? 'Lower' : 'Lägre', detail: en ? 'The available risk metrics have been relatively calm.' : 'De tillgängliga riskmåtten har varit relativt lugna.', tone: 'positive' };
  return { label: en ? 'Historical risk' : 'Historisk risk', value: en ? 'Medium' : 'Medel', detail: en ? 'Risk metrics are mixed or sit between the extremes.' : 'Riskmåtten är blandade eller ligger mellan ytterlägena.', tone: 'neutral' };
}

function toneColor(tone: AxisTone) {
  if (tone === 'positive') return colors.positive;
  if (tone === 'negative') return colors.negative;
  if (tone === 'neutral') return colors.warning;
  return colors.textSecondary;
}

export function NoviceOverview({ item }: { item: StockData }) {
  const { language, t } = useAppLanguage();
  const { width } = useWindowDimensions();
  const valuation = assessValuation(item, language);
  const coverage = calculateDataCoverage(item, language);
  const axes: AxisResult[] = [
    qualityAxis(item, language),
    { label: t('Relativ värdering', 'Relative valuation'), value: valuation.label, detail: valuation.summary, tone: valuation.tone },
    trendAxis(item, language),
    riskAxis(item, language),
  ];
  const positives = getBullPoints(item, language).slice(0, 3);
  const negatives = getBearPoints(item, language).slice(0, 3);
  const uncertainties = [
    valuation.availableComparisons < 2 ? t(`Värderingen har ${valuation.availableComparisons} av 2 relevanta jämförelser.`, `Valuation has ${valuation.availableComparisons} of 2 relevant comparisons.`) : null,
    !item.quality ? t('Rapportdata räcker inte för ett kvalitetsbetyg.', 'Reported data is insufficient for a quality score.') : null,
    t('Alla kurs- och riskmått är bakåtblickande och fångar inte nya bolagshändelser.', 'All price and risk metrics are backward-looking and do not capture new company events.'),
  ].filter((value): value is string => Boolean(value));
  const axisWidth = width >= 900 ? '25%' : width >= 560 ? '50%' : '100%';

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>{t('SNABB ÖVERBLICK', 'QUICK OVERVIEW')}</Text>
          <Text style={styles.title}>{t('Fyra frågor före ett beslut', 'Four questions before a decision')}</Text>
          <Text style={styles.intro}>{t('Kvalitet, värdering, trend och risk bedöms var för sig. Ingen enskild ruta är ett köp- eller säljråd.', 'Quality, valuation, trend and risk are assessed separately. No single box is a buy or sell recommendation.')}</Text>
        </View>
        <View style={styles.coverage}>
          <Text style={styles.coverageLabel}>{t('DATATÄCKNING', 'DATA COVERAGE')}</Text>
          <Text style={styles.coverageValue}>{coverage.available}/{coverage.total}</Text>
          <Text style={styles.coverageText}>{coverage.label}</Text>
        </View>
      </View>

      <View style={styles.axes}>
        {axes.map((axis) => (
          <View key={axis.label} style={[styles.axis, { width: axisWidth }]}>
            <View style={[styles.statusLine, { backgroundColor: toneColor(axis.tone) }]} />
            <Text style={styles.axisLabel}>{axis.label}</Text>
            <Text style={[styles.axisValue, { color: toneColor(axis.tone) }]}>{axis.value}</Text>
            <Text style={styles.axisDetail}>{axis.detail}</Text>
          </View>
        ))}
      </View>

      {valuation.evidence.length > 0 && (
        <Text style={styles.valuationEvidence}>{t('Värderingsunderlag', 'Valuation basis')}: {valuation.evidence.join(' · ')}</Text>
      )}

      <View style={styles.lists}>
        <SummaryList title={t('Talar för', 'Supports the case')} items={positives} empty={t('Inga tydliga positiva faktorer i tillgänglig data.', 'No clear positive factors in the available data.')} color={colors.positive} />
        <SummaryList title={t('Talar emot', 'Challenges the case')} items={negatives} empty={t('Inga tydliga negativa faktorer i tillgänglig data.', 'No clear negative factors in the available data.')} color={colors.negative} />
        <SummaryList title={t('Osäkerheter', 'Uncertainties')} items={uncertainties} empty={t('Inga särskilda dataluckor noterade.', 'No specific data gaps noted.')} color={colors.warning} />
      </View>
    </View>
  );
}

function SummaryList({ title, items, empty, color }: { title: string; items: string[]; empty: string; color: string }) {
  return (
    <View style={styles.list}>
      <Text style={[styles.listTitle, { color }]}>{title}</Text>
      {(items.length ? items : [empty]).map((item, index) => <Text key={`${title}-${index}`} style={styles.listItem}>• {item}</Text>)}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, marginBottom: 20, overflow: 'hidden' },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, padding: 16, flexWrap: 'wrap' },
  headingCopy: { flex: 1, minWidth: 230 },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.textStrong, fontSize: 19, fontWeight: '800', marginTop: 4 },
  intro: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 5, maxWidth: 760 },
  coverage: { minWidth: 100, alignItems: 'flex-end' },
  coverageLabel: { color: colors.textSecondary, fontSize: 9, fontWeight: '800' },
  coverageValue: { color: colors.textStrong, fontFamily: 'monospace', fontSize: 19, fontWeight: '800', marginTop: 2 },
  coverageText: { color: colors.textSecondary, fontSize: 11 },
  axes: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: colors.borderStrong },
  axis: { padding: 14, minHeight: 126, borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong },
  statusLine: { width: 26, height: 3, marginBottom: 10 },
  axisLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  axisValue: { fontSize: 15, fontWeight: '800', marginTop: 5 },
  axisDetail: { color: colors.textBody, fontSize: 11, lineHeight: 16, marginTop: 5 },
  valuationEvidence: { color: colors.textSecondary, fontSize: 11, lineHeight: 16, paddingHorizontal: 16, paddingTop: 12 },
  lists: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, padding: 16 },
  list: { flex: 1, flexBasis: 220, minWidth: 200 },
  listTitle: { fontSize: 12, fontWeight: '800', marginBottom: 7 },
  listItem: { color: colors.textBody, fontSize: 11, lineHeight: 17, marginBottom: 4 },
});
