import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { HintedTouchable } from '@/components/HintedTouchable';
import type { AnalystReport } from '@/lib/analyst-engine';
import { authenticatedFetch } from '@/lib/auth-client';
import type { StockData } from '@/types/stock';

const colors = {
  surface: '#111118',
  border: '#2A2A35',
  text: '#FFFFFF',
  muted: '#8E8E93',
  green: '#34C759',
  amber: '#FF9F0A',
  red: '#FF453A',
  blue: '#0A84FF',
};

interface AnalystBriefProps {
  item: StockData;
}

function verdictColor(verdict: AnalystReport['verdict']) {
  if (verdict === 'Positiv analys') return colors.green;
  if (verdict === 'Avvakta') return colors.red;
  return colors.amber;
}

export function AnalystBrief({ item }: AnalystBriefProps) {
  const [report, setReport] = useState<AnalystReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiAvailable, setAiAvailable] = useState(false);

  useEffect(() => {
    setReport(null);
    setError(null);
    setAiAvailable(false);
  }, [item.ticker]);

  const generateReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authenticatedFetch('/api/analyst', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: item }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.report) throw new Error(payload?.error || 'Kunde inte skapa analysen.');
      setReport(payload.report);
      setAiAvailable(Boolean(payload.aiAvailable));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Kunde inte skapa analysen.');
    } finally {
      setLoading(false);
    }
  };

  const accent = report ? verdictColor(report.verdict) : colors.blue;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Analyst AI</Text>
          <Text style={styles.subtitle}>Generell aktieanalys baserad på aktuell data</Text>
        </View>
        {report && <View style={[styles.score, { borderColor: accent }]}><Text style={[styles.scoreText, { color: accent }]}>{report.score}/100</Text></View>}
      </View>

      {!report && !loading && (
        <Text style={styles.emptyText}>Skapa en tes med styrkor, risker, katalysatorer och tydliga motargument.</Text>
      )}

      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={colors.blue} /><Text style={styles.loadingText}>Analyserar {item.ticker.replace('.ST', '')}</Text></View>
      ) : report ? (
        <View>
          <View style={styles.verdictRow}>
            <Text style={[styles.verdict, { color: accent }]}>{report.verdict}</Text>
            <Text style={styles.confidence}>Konfidens: {report.confidence}</Text>
          </View>
          <Text style={styles.thesis}>{report.thesis}</Text>

          <View style={styles.columns}>
            <InsightList title="Styrkor" color={colors.green} items={report.strengths} />
            <InsightList title="Risker" color={colors.red} items={report.risks} />
          </View>
          <InsightList title="Katalysatorer" color={colors.blue} items={report.catalysts} />

          <View style={styles.invalidation}>
            <Text style={styles.invalidationLabel}>När tesen försvagas</Text>
            <Text style={styles.invalidationText}>{report.invalidation}</Text>
          </View>
          <Text style={styles.meta}>{report.source === 'ai' ? 'AI-sammanfattning' : 'Kvantanalys'} · {new Date(report.generatedAt).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
      ) : null}

      {error && <Text style={styles.error}>{error}</Text>}

      <HintedTouchable
        accessibilityRole="button"
        accessibilityLabel={report ? 'Uppdatera AI-analys' : 'Skapa AI-analys'}
        hint="Skapar en sammanfattning av styrkor, risker, katalysatorer och motargument från aktuell tillgänglig data. Den är beslutsstöd, inte personlig investeringsrådgivning."
        style={[styles.action, loading && styles.actionDisabled]}
        disabled={loading}
        onPress={generateReport}
      >
        <Text style={styles.actionText}>{report ? 'Uppdatera analys' : 'Skapa analys'}</Text>
      </HintedTouchable>

      {report && !aiAvailable && <Text style={styles.fallback}>Lägg till `OPENAI_API_KEY` för en AI-skriven analyskommentar.</Text>}
      <Text style={styles.disclaimer}>Beslutsstöd, inte personlig investeringsrådgivning.</Text>
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
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 4 },
  score: { minWidth: 66, minHeight: 34, borderWidth: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  scoreText: { fontFamily: 'monospace', fontSize: 13, fontWeight: '700' },
  emptyText: { color: '#D1D1D6', lineHeight: 19, fontSize: 13, marginBottom: 14 },
  loading: { minHeight: 100, justifyContent: 'center', alignItems: 'center', gap: 10 },
  loadingText: { color: colors.muted, fontSize: 13 },
  verdictRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 8 },
  verdict: { fontSize: 16, fontWeight: '700' },
  confidence: { color: colors.muted, fontSize: 12 },
  thesis: { color: colors.text, fontSize: 14, lineHeight: 20, marginBottom: 14 },
  columns: { flexDirection: 'row', gap: 12 },
  insight: { flex: 1, marginBottom: 12 },
  insightTitle: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  insightItem: { color: '#D1D1D6', fontSize: 12, lineHeight: 18, marginBottom: 3 },
  invalidation: { borderLeftWidth: 2, borderLeftColor: colors.amber, paddingLeft: 10, marginTop: 2, marginBottom: 12 },
  invalidationLabel: { color: colors.amber, fontSize: 12, fontWeight: '700', marginBottom: 3 },
  invalidationText: { color: '#D1D1D6', fontSize: 12, lineHeight: 18 },
  meta: { color: colors.muted, fontSize: 11, marginBottom: 12 },
  action: { minHeight: 42, borderRadius: 6, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  actionDisabled: { opacity: 0.55 },
  actionText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  error: { color: colors.red, fontSize: 12, marginBottom: 10 },
  fallback: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 10 },
  disclaimer: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 8 },
});
