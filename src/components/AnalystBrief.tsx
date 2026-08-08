import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { HintedTouchable } from '@/components/HintedTouchable';
import type { AnalystReport } from '@/lib/analyst-engine';
import { authenticatedFetch } from '@/lib/auth-client';
import type { StockData } from '@/types/stock';
import { colors as palette } from '@/theme';
import { useAppLanguage } from '@/components/AppLanguage';

const colors = {
  surface: palette.surface,
  border: palette.borderStrong,
  text: palette.textStrong,
  muted: palette.textSecondary,
  green: palette.positive,
  amber: palette.warning,
  red: palette.negative,
  blue: palette.accent,
};

interface AnalystBriefProps {
  item: StockData;
  onReportGenerated?: (report: AnalystReport) => void;
}

function verdictColor(verdict: AnalystReport['verdict']) {
  if (verdict === 'Positiv analys' || verdict === 'Positive') return colors.green;
  if (verdict === 'Avvakta' || verdict === 'Wait') return colors.red;
  return colors.amber;
}

export function AnalystBrief({ item, onReportGenerated }: AnalystBriefProps) {
  const { language, locale, t } = useAppLanguage();
  const [report, setReport] = useState<AnalystReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [aiQuotaRemaining, setAiQuotaRemaining] = useState<number | null>(null);
  const [aiQuotaUsed, setAiQuotaUsed] = useState<number | null>(null);
  const [aiDailyLimit, setAiDailyLimit] = useState<number | null>(null);
  const quotaRequest = useRef(0);

  const applyQuota = (payload: Record<string, unknown>) => {
    setAiStatus(typeof payload.aiStatus === 'string' ? payload.aiStatus : null);
    setAiQuotaRemaining(typeof payload.aiQuotaRemaining === 'number' ? payload.aiQuotaRemaining : null);
    setAiQuotaUsed(typeof payload.aiQuotaUsed === 'number' ? payload.aiQuotaUsed : null);
    setAiDailyLimit(typeof payload.aiDailyLimit === 'number' ? payload.aiDailyLimit : null);
  };

  useEffect(() => {
    setReport(null);
    setError(null);
    setAiAvailable(false);
    setAiStatus(null);
    setAiQuotaRemaining(null);
    setAiQuotaUsed(null);
    setAiDailyLimit(null);

    const requestId = ++quotaRequest.current;
    authenticatedFetch('/api/analyst')
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (requestId === quotaRequest.current && payload) applyQuota(payload);
      })
      .catch(() => undefined);
  }, [item.ticker, language]);

  const generateReport = async () => {
    const requestId = ++quotaRequest.current;
    setLoading(true);
    setError(null);
    try {
      const response = await authenticatedFetch('/api/analyst', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: item, language }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.report) throw new Error(payload?.error || t('Kunde inte skapa analysen.', 'Could not create the analysis.'));
      setReport(payload.report);
      onReportGenerated?.(payload.report);
      setAiAvailable(Boolean(payload.aiAvailable));
      if (requestId === quotaRequest.current) applyQuota(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('Kunde inte skapa analysen.', 'Could not create the analysis.'));
    } finally {
      setLoading(false);
    }
  };

  const accent = report ? verdictColor(report.verdict) : colors.blue;
  const quotaExhausted = aiStatus === 'quota-exhausted'
    || (aiDailyLimit != null && aiDailyLimit > 0 && aiQuotaRemaining === 0);
  const quotaText = aiStatus === 'disabled'
    ? t('Ej aktiverat', 'Not enabled')
    : aiDailyLimit === 0
      ? t('Obegränsat', 'Unlimited')
      : aiDailyLimit != null && aiQuotaUsed != null
        ? `${Math.min(aiQuotaUsed, aiDailyLimit)} ${t('av', 'of')} ${aiDailyLimit}`
        : t('Hämtar...', 'Loading...');

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('Analyst AI', 'Analyst AI')}</Text>
          <Text style={styles.subtitle}>{t('Generell aktieanalys baserad på aktuell data', 'General equity analysis based on current data')}</Text>
        </View>
        <View style={styles.headerStats}>
          <View style={[styles.quota, quotaExhausted && styles.quotaExhausted]}>
            <Text style={styles.quotaLabel}>{t('AI-ANALYSER I DAG', 'AI ANALYSES TODAY')}</Text>
            <Text style={[styles.quotaText, quotaExhausted && styles.quotaTextExhausted]}>{quotaText}</Text>
          </View>
          {report && (
            <View style={[styles.score, { borderColor: accent }]}>
              <Text style={styles.scoreLabel}>{t('MODELLPOÄNG', 'MODEL SCORE')}</Text>
              <Text style={[styles.scoreText, { color: accent }]}>{report.score}/100</Text>
            </View>
          )}
        </View>
      </View>

      {!report && !loading && (
        <Text style={styles.emptyText}>{t('Skapa en tes med styrkor, risker, katalysatorer och tydliga motargument.', 'Create a thesis with strengths, risks, catalysts and clear counterarguments.')}</Text>
      )}

      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={colors.blue} /><Text style={styles.loadingText}>{t('Analyserar', 'Analysing')} {item.ticker.replace('.ST', '')}</Text></View>
      ) : report ? (
        <View>
          <View style={styles.verdictRow}>
            <Text style={[styles.verdict, { color: accent }]}>{report.verdict}</Text>
            <Text style={styles.coverage}>
              {t('Datatäckning', 'Data coverage')}: {report.dataCoverage.available}/{report.dataCoverage.total} ({report.dataCoverage.label.toLowerCase()})
            </Text>
          </View>
          <Text style={styles.thesis}>{report.thesis}</Text>

          <View style={styles.columns}>
            <InsightList title={t('Styrkor', 'Strengths')} color={colors.green} items={report.strengths} />
            <InsightList title={t('Risker', 'Risks')} color={colors.red} items={report.risks} />
          </View>
          <InsightList title={t('Katalysatorer', 'Catalysts')} color={colors.blue} items={report.catalysts} />

          <View style={styles.invalidation}>
            <Text style={styles.invalidationLabel}>{t('När tesen försvagas', 'When the thesis weakens')}</Text>
            <Text style={styles.invalidationText}>{report.invalidation}</Text>
          </View>
          <Text style={styles.meta}>{report.source === 'ai' ? t('AI-sammanfattning', 'AI summary') : t('Kvantanalys', 'Quant analysis')} · {new Date(report.generatedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
      ) : null}

      {error && <Text style={styles.error}>{error}</Text>}

      <HintedTouchable
        accessibilityRole="button"
        accessibilityLabel={report ? t('Uppdatera AI-analys', 'Update AI analysis') : t('Skapa AI-analys', 'Create AI analysis')}
        hint={t('Skapar en sammanfattning av styrkor, risker, katalysatorer och motargument från aktuell tillgänglig data. Den är beslutsstöd, inte personlig investeringsrådgivning.', 'Creates a summary of strengths, risks, catalysts and counterarguments from currently available data. It is decision support, not personal investment advice.')}
        style={[styles.action, loading && styles.actionDisabled]}
        disabled={loading}
        onPress={generateReport}
      >
        <Text style={styles.actionText}>
          {quotaExhausted
            ? t('Visa kvantanalys · dagsgräns nådd', 'View quant analysis · daily limit reached')
            : report ? t('Uppdatera analys', 'Update analysis') : t('Skapa analys', 'Create analysis')}
        </Text>
      </HintedTouchable>

      {report && !aiAvailable && (
        <Text style={styles.fallback}>
          {quotaExhausted
            ? t('Dagens AI-gräns är nådd. Den regelbaserade analysen visas tills dagskvoten återställs.', "Today's AI limit has been reached. The rule-based analysis is shown until the daily quota resets.")
            : aiStatus === 'request-failed'
              ? t('AI-tjänsten svarade inte. Den regelbaserade analysen visas i stället.', 'The AI service did not respond. The rule-based analysis is shown instead.')
              : t('Analysen är regelbaserad. AI-skriven kommentar kräver att administratören gett ditt konto behörighet till modulen.', 'This analysis is rule-based. AI-written commentary requires the administrator to enable the module for your account.')}
        </Text>
      )}
      {report && aiAvailable && quotaExhausted && (
        <Text style={styles.fallback}>{t('Dagens AI-gräns är nu nådd. Den visade AI-analysen är sparad i cache och dagskvoten återställs nästa svenska kalenderdag.', 'Today\'s AI limit has now been reached. The displayed AI analysis is cached and the daily quota resets on the next Swedish calendar day.')}</Text>
      )}
      {report && aiAvailable && !quotaExhausted && aiQuotaRemaining != null && (
        <Text style={styles.fallback}>{t(`${aiQuotaRemaining} AI-anrop återstår i dag.`, `${aiQuotaRemaining} AI requests remain today.`)}</Text>
      )}
      <Text style={styles.disclaimer}>{t('Modellpoängen är en sammanvägning av regler, inte en sannolikhet för uppgång. Beslutsstöd, inte personlig investeringsrådgivning.', 'The model score combines rules; it is not a probability of a price increase. Decision support, not personal investment advice.')}</Text>
    </View>
  );
}

interface InsightListProps {
  title: string;
  color: string;
  items: string[];
}

function InsightList({ title, color, items }: InsightListProps) {
  return (
    <View style={styles.insight}>
      <Text style={[styles.insightTitle, { color }]}>{title}</Text>
      {items.map((item, index) => <Text key={`${index}-${item}`} style={styles.insightItem}>• {item}</Text>)}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 16, marginBottom: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  headerStats: { flexDirection: 'row', alignItems: 'stretch', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 4 },
  score: { minWidth: 82, minHeight: 44, borderWidth: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  scoreLabel: { color: colors.muted, fontSize: 8, fontWeight: '700', marginBottom: 2 },
  scoreText: { fontFamily: 'monospace', fontSize: 13, fontWeight: '700' },
  quota: { minWidth: 108, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 6, justifyContent: 'center', paddingHorizontal: 9 },
  quotaExhausted: { borderColor: colors.amber },
  quotaLabel: { color: colors.muted, fontSize: 8, fontWeight: '700', marginBottom: 3 },
  quotaText: { color: colors.text, fontFamily: 'monospace', fontSize: 12, fontWeight: '700' },
  quotaTextExhausted: { color: colors.amber },
  emptyText: { color: colors.text, lineHeight: 19, fontSize: 13, marginBottom: 14 },
  loading: { minHeight: 100, justifyContent: 'center', alignItems: 'center', gap: 10 },
  loadingText: { color: colors.muted, fontSize: 13 },
  verdictRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 8 },
  verdict: { fontSize: 16, fontWeight: '700' },
  coverage: { color: colors.muted, fontSize: 12, textAlign: 'right', flexShrink: 1 },
  thesis: { color: colors.text, fontSize: 14, lineHeight: 20, marginBottom: 14 },
  columns: { flexDirection: 'row', gap: 12 },
  insight: { flex: 1, marginBottom: 12 },
  insightTitle: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  insightItem: { color: colors.text, fontSize: 12, lineHeight: 18, marginBottom: 3 },
  invalidation: { borderLeftWidth: 2, borderLeftColor: colors.amber, paddingLeft: 10, marginTop: 2, marginBottom: 12 },
  invalidationLabel: { color: colors.amber, fontSize: 12, fontWeight: '700', marginBottom: 3 },
  invalidationText: { color: colors.text, fontSize: 12, lineHeight: 18 },
  meta: { color: colors.muted, fontSize: 11, marginBottom: 12 },
  action: { minHeight: 42, borderRadius: 6, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  actionDisabled: { opacity: 0.55 },
  actionText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  error: { color: colors.red, fontSize: 12, marginBottom: 10 },
  fallback: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 10 },
  disclaimer: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 8 },
});
