import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { HintedTouchable } from '@/components/HintedTouchable';
import { authenticatedFetch } from '@/lib/auth-client';
import { formatNumber, formatSignedPercent } from '@/lib/format';
import { colors as palette } from '@/theme';

interface Summary {
  n: number;
  mean: number;
  median: number;
  hitRate: number;
  tStat: number;
}

interface Bucket {
  label: string;
  minScore: number;
  maxScore: number;
  horizons: Record<string, Summary | null>;
}

interface Backtest {
  baseline: Record<string, Summary | null>;
  buckets: Bucket[];
  observations: number;
  tickers: number;
  horizons: number[];
  generatedAt: string;
}

const HORIZON = '60';
const MINIMUM_OBSERVATIONS = 30;

/**
 * Svaret på om rekylläget förutsagt något.
 *
 * Det viktiga talet är inte hur en grupp gått, utan hur den gått **jämfört med
 * genomsnittsdagen**. En grupp som ger +1 % när baslinjen ger +2 % är en signal
 * med negativt värde, trots att talet i sig är positivt. Därför visas kanten
 * mot baslinjen som huvudsiffra.
 */
export function RekylBacktestPanel() {
  const [backtest, setBacktest] = useState<Backtest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authenticatedFetch('/api/rekyl-backtest?market=omxs30&years=10');
      const payload = await response.json() as { result?: Backtest; error?: string };
      if (!response.ok || !payload.result) throw new Error(payload.error || 'Mätningen kunde inte köras.');
      setBacktest(payload.result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Mätningen kunde inte köras.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const baseline = backtest?.baseline[HORIZON] ?? null;

  return (
    <View>
      <Text style={styles.intro}>
        Rekylpoängen räknas om för varje månad i historiken, med enbart den information som fanns då.
        Sedan mäts hur aktien gick de följande 60 handelsdagarna, med indexets rörelse borträknad.
      </Text>

      {loading && !backtest ? (
        <View style={styles.loading}>
          <ActivityIndicator color={palette.accent} />
          <Text style={styles.loadingText}>Räknar tio år för trettio bolag. Tar en stund.</Text>
        </View>
      ) : backtest ? (
        <>
          <Text style={styles.meta}>
            {backtest.observations} mätpunkter från {backtest.tickers} bolag
            {baseline ? ` · Genomsnittsdagen gav ${formatSignedPercent(baseline.mean)} på 60 dagar` : ''}
          </Text>

          {backtest.buckets.map((bucket) => {
            const summary = bucket.horizons[HORIZON];
            const edge = summary && baseline ? summary.mean - baseline.mean : null;
            const trustworthy = Boolean(summary && summary.n >= MINIMUM_OBSERVATIONS && Math.abs(summary.tStat) >= 2);
            const edgeColor = edge == null ? palette.textSecondary : edge > 0 ? palette.positive : palette.negative;

            return (
              <View key={bucket.label} style={styles.bucket}>
                <View style={styles.bucketHeader}>
                  <Text style={styles.bucketTitle}>{bucket.label}</Text>
                  <Text style={styles.bucketCount}>n = {summary?.n ?? 0}</Text>
                </View>

                <View style={styles.metrics}>
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Mot index</Text>
                    <Text style={styles.metricValue}>{formatSignedPercent(summary?.mean ?? null)}</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Mot genomsnittsdagen</Text>
                    <Text style={[styles.metricValue, { color: edgeColor }]}>{formatSignedPercent(edge)}</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Andel positiva</Text>
                    <Text style={styles.metricValue}>{summary ? `${formatNumber(summary.hitRate, 0)} %` : '-'}</Text>
                  </View>
                </View>

                <Text style={[styles.verdict, trustworthy ? styles.verdictSolid : styles.verdictWeak]}>
                  {!summary || summary.n < MINIMUM_OBSERVATIONS
                    ? `För få mätpunkter (${summary?.n ?? 0}) för att säga något`
                    : trustworthy
                      ? `Skiljer sig från slumpen (t = ${formatNumber(summary.tStat, 1)})`
                      : `Går inte att skilja från slumpen (t = ${formatNumber(summary.tStat, 1)})`}
                </Text>
              </View>
            );
          })}

          <Text style={styles.caveat}>
            Läs resultatet med tre reservationer. Listan är dagens OMXS30-bolag, alltså de som klarade sig,
            vilket gör utfallet för optimistiskt. Bara sju av nio poäng går att räkna bakåt i tiden; positiv
            vinst och utdelning kommer från dagens uppgifter och är utelämnade. Och perioden domineras av en
            lång uppgångsfas, vilket gynnar allt som liknar att köpa nedgångar.
          </Text>
        </>
      ) : null}

      {error && <Text style={styles.error}>{error}</Text>}

      <HintedTouchable
        style={[styles.action, loading && styles.actionDisabled]}
        disabled={loading}
        onPress={() => { void load(); }}
        accessibilityLabel="Kör mätningen igen"
        hint="Hämtar tio års kurshistorik för hela urvalet och räknar om utfallet. Resultatet sparas ett halvt dygn."
      >
        <Text style={styles.actionText}>{loading ? 'Räknar...' : 'Kör om mätningen'}</Text>
      </HintedTouchable>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { minHeight: 90, justifyContent: 'center', alignItems: 'center', gap: 10 },
  loadingText: { color: palette.textSecondary, fontSize: 12 },
  intro: { color: palette.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 10 },
  meta: { color: palette.textMuted, fontSize: 11, marginBottom: 14, lineHeight: 16 },
  bucket: {
    borderWidth: 1, borderColor: palette.border, borderRadius: 8,
    padding: 12, marginBottom: 10, backgroundColor: palette.surface,
  },
  bucketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  bucketTitle: { color: palette.textPrimary, fontSize: 13, fontWeight: '700', flex: 1 },
  bucketCount: { color: palette.textMuted, fontSize: 11, fontVariant: ['tabular-nums'] },
  metrics: { flexDirection: 'row', gap: 12 },
  metric: { flex: 1 },
  metricLabel: { color: palette.textMuted, fontSize: 10, marginBottom: 3 },
  metricValue: { color: palette.textPrimary, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  verdict: { fontSize: 11, lineHeight: 16, marginTop: 10 },
  verdictSolid: { color: palette.positive },
  verdictWeak: { color: palette.textMuted },
  caveat: { color: palette.textMuted, fontSize: 11, lineHeight: 16, marginTop: 6 },
  error: { color: palette.negative, fontSize: 12, marginTop: 10 },
  action: {
    marginTop: 14, minHeight: 40, borderRadius: 6, borderWidth: 1,
    borderColor: palette.accentBorder, backgroundColor: palette.accentBg,
    alignItems: 'center', justifyContent: 'center',
  },
  actionDisabled: { opacity: 0.55 },
  actionText: { color: palette.accent, fontSize: 13, fontWeight: '700' },
});
