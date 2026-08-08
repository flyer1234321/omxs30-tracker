import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { HintedTouchable } from '@/components/HintedTouchable';
import { authenticatedFetch } from '@/lib/auth-client';
import { formatSignedPercent } from '@/lib/format';
import { colors as palette } from '@/theme';
import type { StockData } from '@/types/stock';
import { useAppLanguage } from '@/components/AppLanguage';

interface EarningsEvent {
  quarter: string;
  period: string;
  surprisePercent: number | null;
  announcementDate: string;
  volumeRatio: number;
  reactionPercent: number | null;
  abnormalDriftPercent: Record<string, number | null>;
}

interface StudyResponse {
  study: { events: EarningsEvent[] };
}

/**
 * Bolagets egna senaste rapporter. Yahoo lämnar bara ut ett fåtal kvartal, så
 * det här är sammanhang - inte statistik. Slutsatser om rapportmönster dras på
 * hela urvalet i administrationsvyn, där stickprovet är stort nog att betyda
 * något.
 *
 * Hämtningen sker först när användaren ber om den: två extra anrop per bolag
 * mot ett gratis-API vore slöseri på en vy som ofta bara ögnas.
 */
export function EarningsHistory({ item }: { item: StockData }) {
  const { t } = useAppLanguage();
  const [events, setEvents] = useState<EarningsEvent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await authenticatedFetch(`/api/earnings-study?ticker=${encodeURIComponent(item.ticker)}`);
      if (!response.ok) throw new Error(t('Kunde inte hämta rapporthistoriken.', 'Could not load earnings history.'));
      const payload = await response.json() as StudyResponse;
      setEvents(payload.study?.events ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('Kunde inte hämta rapporthistoriken.', 'Could not load earnings history.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{t('Kursen efter rapport', 'Price after earnings')}</Text>
      <Text style={styles.subtitle}>
        {t('Vinstöverraskning mot analytikernas snitt, och hur kursen gick därefter jämfört med index.', 'Earnings surprise versus analyst consensus and subsequent price performance relative to the index.')}
      </Text>

      {events === null ? (
        <>
          {loading ? (
            <View style={styles.loading}><ActivityIndicator color={palette.accent} /></View>
          ) : (
            <HintedTouchable
              style={styles.action}
              onPress={load}
              accessibilityLabel={t('Hämta rapporthistorik', 'Load earnings history')}
              hint={t('Hämtar bolagets senaste kvartalsrapporter och visar hur kursen utvecklades efter varje.', 'Loads the company’s latest quarterly reports and shows subsequent price performance.')}
            >
              <Text style={styles.actionText}>{t('Visa rapporthistorik', 'Show earnings history')}</Text>
            </HintedTouchable>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
        </>
      ) : events.length === 0 ? (
        <Text style={styles.empty}>
          {t(
            'Yahoo saknar tillräcklig rapport- eller volymhistorik för det här bolaget. Det är vanligt för mindre svenska bolag och betyder inte att bolaget saknar kvartalsrapporter.',
            'Yahoo does not provide enough earnings or volume history for this company. This is common for smaller Swedish companies and does not mean that the company has no quarterly reports.'
          )}
        </Text>
      ) : (
        <>
          <View style={styles.headerRow}>
            <Text style={[styles.headerCell, styles.periodCell]}>{t('Kvartal', 'Quarter')}</Text>
            <Text style={styles.headerCell}>{t('Överrask.', 'Surprise')}</Text>
            <Text style={styles.headerCell}>{t('Dagen', 'Day')}</Text>
            <Text style={styles.headerCell}>20 d</Text>
            <Text style={styles.headerCell}>60 d</Text>
          </View>

          {events.map((event) => (
            <View key={`${event.quarter}-${event.announcementDate}`} style={styles.row}>
              <View style={styles.periodCell}>
                <Text style={styles.periodText}>{event.period}</Text>
                <Text style={styles.dateText}>{event.announcementDate}</Text>
              </View>
              <Text style={[styles.cell, tone(event.surprisePercent)]}>{formatSignedPercent(event.surprisePercent, 0)}</Text>
              <Text style={[styles.cell, tone(event.reactionPercent)]}>{formatSignedPercent(event.reactionPercent)}</Text>
              <Text style={[styles.cell, tone(event.abnormalDriftPercent['20'])]}>{formatSignedPercent(event.abnormalDriftPercent['20'])}</Text>
              <Text style={[styles.cell, tone(event.abnormalDriftPercent['60'])]}>{formatSignedPercent(event.abnormalDriftPercent['60'])}</Text>
            </View>
          ))}

          <Text style={styles.footnote}>
            {t(
              'Kolumnerna 20 d och 60 d visar överavkastning: aktiens rörelse minus indexets under samma period. Ett streck under Överrask. betyder att Yahoo saknar analytikerkonsensus för kvartalet. Rapportdagen är uppskattad från volymtoppen, eftersom Yahoo ofta bara lämnar ut kvartalets slutdatum. Med så här få rapporter går inget mönster att belägga - siffrorna är sammanhang, inte bevis.',
              'The 20 d and 60 d columns show excess return: the stock move minus the index move over the same period. A dash under Surprise means that Yahoo has no analyst consensus for the quarter. The report date is estimated from the volume peak because Yahoo often provides only the quarter-end date. This small sample cannot establish a pattern; the figures provide context, not proof.'
            )}
          </Text>
        </>
      )}
    </View>
  );
}

function tone(value: number | null | undefined) {
  if (value == null) return styles.neutral;
  return value >= 0 ? styles.positive : styles.negative;
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
    marginBottom: 24,
  },
  title: { color: palette.textStrong, fontSize: 16, fontWeight: '700' },
  subtitle: { color: palette.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: 14 },
  action: {
    minHeight: 40, borderRadius: 6, borderWidth: 1, borderColor: palette.accentBorder,
    backgroundColor: palette.accentBg, alignItems: 'center', justifyContent: 'center',
  },
  actionText: { color: palette.accent, fontSize: 13, fontWeight: '700' },
  loading: { minHeight: 60, justifyContent: 'center', alignItems: 'center' },
  empty: { color: palette.textSecondary, fontSize: 13, lineHeight: 19 },
  error: { color: palette.negative, fontSize: 12, marginTop: 10 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: palette.border,
  },
  headerCell: {
    flex: 1, textAlign: 'right', color: palette.textMuted, fontSize: 9,
    fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border,
  },
  periodCell: { flex: 1.4, alignItems: 'flex-start' },
  periodText: { color: palette.textPrimary, fontSize: 12, fontWeight: '600' },
  dateText: { color: palette.textMuted, fontSize: 10, marginTop: 1 },
  cell: { flex: 1, textAlign: 'right', fontSize: 12, fontVariant: ['tabular-nums'] },
  positive: { color: palette.positive },
  negative: { color: palette.negative },
  neutral: { color: palette.textSecondary },
  footnote: { color: palette.textMuted, fontSize: 11, lineHeight: 16, marginTop: 12 },
});
