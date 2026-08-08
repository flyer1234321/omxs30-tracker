import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { HintedTouchable } from '@/components/HintedTouchable';
import { useAppLanguage } from '@/components/AppLanguage';
import { authenticatedFetch } from '@/lib/auth-client';
import { formatNumber, formatSignedPercent } from '@/lib/format';
import { SURPRISE_BUCKET_LABELS, type SurpriseBucket } from '@/lib/event-study';
import { colors as palette } from '@/theme';

interface Summary {
  n: number;
  mean: number;
  median: number;
  hitRate: number;
  tStat: number;
}

interface BucketResult {
  bucket: SurpriseBucket;
  reaction: Summary | null;
  drift: Record<string, Summary | null>;
}

interface Study {
  buckets: BucketResult[];
  events: unknown[];
  tickersRequested: number;
  tickersWithData: number;
  generatedAt: string;
}

/** Samma gränser som isStatisticallyInteresting på serversidan. */
const MINIMUM_OBSERVATIONS = 20;
const MINIMUM_T_STAT = 2;

export function EarningsStudyPanel() {
  const { language, locale } = useAppLanguage();
  const [study, setStudy] = useState<Study | null>(null);
  const [loading, setLoading] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (recompute = false) => {
    if (recompute) setRecomputing(true); else setLoading(true);
    setError(null);
    try {
      const response = await authenticatedFetch('/api/earnings-study?market=omxs30', {
        method: recompute ? 'POST' : 'GET',
      });
      if (!response.ok) throw new Error(language === 'en' ? 'Could not load the study.' : 'Kunde inte hämta studien.');
      const payload = await response.json() as { study: Study };
      setStudy(payload.study);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : language === 'en' ? 'Could not load the study.' : 'Kunde inte hämta studien.');
    } finally {
      setLoading(false);
      setRecomputing(false);
    }
  }, [language]);

  useEffect(() => { void load(); }, [load]);

  if (loading && !study) {
    return <View style={styles.loading}><ActivityIndicator color={palette.accent} /></View>;
  }

  return (
    <View>
      <Text style={styles.intro}>
        {language === 'en'
          ? 'For each OMXS30 quarterly report, earnings are compared with the analyst consensus. The share performance over the following 20 and 60 trading days is then measured relative to the index.'
          : 'För varje kvartalsrapport i OMXS30 jämförs vinsten mot analytikernas snitt. Sedan mäts hur kursen gick de följande 20 och 60 handelsdagarna, med indexets rörelse borträknad.'}
      </Text>

      {study && (
        <>
          <Text style={styles.meta}>
            {language === 'en'
              ? `${study.events.length} reports from ${study.tickersWithData} of ${study.tickersRequested} companies`
              : `${study.events.length} rapporter från ${study.tickersWithData} av ${study.tickersRequested} bolag`}
            {' · '}{language === 'en' ? 'Calculated' : 'Beräknad'} {new Date(study.generatedAt).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}
          </Text>

          {study.buckets.map((bucket) => {
            const drift20 = bucket.drift['20'];
            const drift60 = bucket.drift['60'];
            const solid = drift20 != null && drift20.n >= MINIMUM_OBSERVATIONS && Math.abs(drift20.tStat) >= MINIMUM_T_STAT;

            return (
              <View key={bucket.bucket} style={styles.bucket}>
                <View style={styles.bucketHeader}>
                  <Text style={styles.bucketTitle}>{language === 'en' ? englishBucketLabels[bucket.bucket] : SURPRISE_BUCKET_LABELS[bucket.bucket]}</Text>
                  <Text style={styles.bucketCount}>n = {drift20?.n ?? 0}</Text>
                </View>

                <View style={styles.metrics}>
                  <Metric label={language === 'en' ? 'Report day' : 'Rapportdagen'} summary={bucket.reaction} language={language} />
                  <Metric label={language === 'en' ? '20 days later' : '20 dagar efter'} summary={drift20} language={language} />
                  <Metric label={language === 'en' ? '60 days later' : '60 dagar efter'} summary={drift60} language={language} />
                </View>

                <Text style={[styles.verdict, solid ? styles.verdictSolid : styles.verdictWeak]}>
                  {solid
                    ? language === 'en'
                      ? `Statistically distinguishable from chance (t = ${formatNumber(drift20.tStat, 1)}), ${formatNumber(drift20.hitRate, 0)}% positive`
                      : `Skiljer sig från slumpen (t = ${formatNumber(drift20.tStat, 1)}), ${formatNumber(drift20.hitRate, 0)} % positiva`
                    : drift20 == null || drift20.n === 0
                      ? language === 'en' ? 'No observations in this group' : 'Inga observationer i den här gruppen'
                      : language === 'en' ? `Not distinguishable from chance with ${drift20.n} observations` : `Går inte att skilja från slumpen med ${drift20.n} observationer`}
                </Text>
              </View>
            );
          })}

          <Text style={styles.caveat}>
            {language === 'en'
              ? `Read the figures with three caveats. The list contains today's OMXS30 constituents, which creates survivorship bias. The report date is estimated from the volume peak because Yahoo only provides the quarter-end date. A handful of quarters per company is also a small sample; groups with fewer than ${MINIMUM_OBSERVATIONS} observations are inconclusive.`
              : `Läs siffrorna med tre reservationer. Listan innehåller dagens OMXS30-bolag, alltså de som klarade sig, vilket gör utfallet för optimistiskt. Rapportdagen är uppskattad från volymtoppen eftersom Yahoo bara lämnar ut kvartalets slutdatum. Och en handfull kvartal per bolag är ett litet underlag - grupper med färre än ${MINIMUM_OBSERVATIONS} observationer säger ingenting alls.`}
          </Text>
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <HintedTouchable
        style={[styles.action, recomputing && styles.actionDisabled]}
        disabled={recomputing}
        onPress={() => { void load(true); }}
        accessibilityLabel={language === 'en' ? 'Recalculate study' : 'Räkna om studien'}
        hint={language === 'en' ? 'Fetches report history from Yahoo again and recalculates the results. This takes a while and makes one request per company.' : 'Hämtar rapporthistoriken på nytt från Yahoo och räknar om utfallet. Tar en stund och gör ett anrop per bolag.'}
      >
        <Text style={styles.actionText}>{recomputing ? (language === 'en' ? 'Recalculating...' : 'Räknar om...') : (language === 'en' ? 'Recalculate study' : 'Räkna om studien')}</Text>
      </HintedTouchable>
    </View>
  );
}

const englishBucketLabels: Record<SurpriseBucket, string> = {
  stor_positiv: 'Large positive surprise (over 10%)',
  positiv: 'Positive surprise (2-10%)',
  neutral: 'In line (within 2%)',
  negativ: 'Negative surprise (2-10%)',
  stor_negativ: 'Large negative surprise (over 10%)',
};

function Metric({ label, summary, language }: { label: string; summary: Summary | null; language: 'sv' | 'en' }) {
  const value = summary?.mean ?? null;
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, value == null ? styles.neutral : value >= 0 ? styles.positive : styles.negative]}>
        {formatSignedPercent(value)}
      </Text>
      {summary && <Text style={styles.metricMedian}>{language === 'en' ? 'median' : 'median'} {formatSignedPercent(summary.median)}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { minHeight: 80, justifyContent: 'center', alignItems: 'center' },
  intro: { color: palette.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 10 },
  meta: { color: palette.textMuted, fontSize: 11, marginBottom: 14 },
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
  metricValue: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  metricMedian: { color: palette.textMuted, fontSize: 10, marginTop: 2 },
  positive: { color: palette.positive },
  negative: { color: palette.negative },
  neutral: { color: palette.textSecondary },
  verdict: { fontSize: 11, lineHeight: 16, marginTop: 10 },
  verdictSolid: { color: palette.positive },
  verdictWeak: { color: palette.textMuted },
  caveat: { color: palette.textMuted, fontSize: 11, lineHeight: 16, marginTop: 6, marginBottom: 4 },
  error: { color: palette.negative, fontSize: 12, marginTop: 10 },
  action: {
    marginTop: 14, minHeight: 40, borderRadius: 6, borderWidth: 1,
    borderColor: palette.accentBorder, backgroundColor: palette.accentBg,
    alignItems: 'center', justifyContent: 'center',
  },
  actionDisabled: { opacity: 0.55 },
  actionText: { color: palette.accent, fontSize: 13, fontWeight: '700' },
});
