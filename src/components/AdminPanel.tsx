import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HintedTouchable } from '@/components/HintedTouchable';
import { authenticatedFetch } from '@/lib/auth-client';
import { colors as palette } from '@/theme';
import { EarningsStudyPanel } from '@/components/EarningsStudyPanel';
import { UserAdmin } from '@/components/UserAdmin';
import { RekylBacktestPanel } from '@/components/RekylBacktestPanel';
import { useAppLanguage } from '@/components/AppLanguage';

interface AdminStatus {
  configured: Record<string, boolean>;
  access: { allowedEmails: number; adminEmails: number };
  markets: { stockholmOpen: boolean; usOpen: boolean };
  alerts: { sent: number; failed: number; pending: number; latest: string | null } | null;
  checkedAt: string;
}

const LABELS: Record<string, [string, string]> = {
  magicLink: ['Inloggning med e-postlänk', 'Email link sign-in'],
  passwordLogin: ['Inloggning med lösenord', 'Password sign-in'],
  openAi: ['AI-skriven analystext', 'AI-written analysis'],
  supabaseServiceKey: ['Servernyckel för Supabase', 'Supabase server key'],
  resend: ['E-postutskick via Resend', 'Email delivery via Resend'],
  cronSecret: ['Hemlighet för schemalagda jobb', 'Scheduled job secret'],
  appUrl: ['Publik adress (APP_URL)', 'Public address (APP_URL)'],
};

interface AdminPanelProps {
  visible: boolean;
  onClose: () => void;
  currentEmail: string | null;
}

export function AdminPanel({ visible, onClose, currentEmail }: AdminPanelProps) {
  const { language, locale, t } = useAppLanguage();
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await authenticatedFetch('/api/admin/status');
      if (!response.ok) throw new Error(t('Kunde inte läsa statusen.', 'Could not load the status.'));
      setStatus(await response.json() as AdminStatus);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Kunde inte läsa statusen.', 'Could not load the status.'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  const runDigest = async () => {
    if (running) return;
    setRunning(true);
    setMessage(null);
    try {
      const response = await authenticatedFetch('/api/alerts/daily?force=1');
      const data = await response.json() as { ok?: boolean; sent?: number; users?: number; error?: string };
      setMessage(data.ok
        ? t(
          `Klart. ${data.sent ?? 0} mejl skickade till ${data.users ?? 0} bevakande användare.`,
          `Done. ${data.sent ?? 0} emails sent to ${data.users ?? 0} users with monitoring enabled.`,
        )
        : data.error || t('Jobbet kunde inte köras.', 'The job could not be run.'));
      void load();
    } catch {
      setMessage(t('Kunde inte köra jobbet.', 'Could not run the job.'));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('Administration', 'Administration')}</Text>
          <HintedTouchable style={styles.close} onPress={onClose} accessibilityLabel={t('Stäng administrationsvyn', 'Close administration')} hint={t('Stänger administrationsvyn.', 'Closes the administration view.')}>
            <Text style={styles.closeText}>✕</Text>
          </HintedTouchable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {loading && !status ? <ActivityIndicator color={palette.accent} /> : status ? (
            <>
              <Text style={styles.sectionTitle}>{t('Konfiguration', 'Configuration')}</Text>
              <Text style={styles.sectionNote}>
                {t('Visar bara om värdena är satta, aldrig vad de innehåller.', 'Only shows whether values are set, never what they contain.')}
              </Text>
              {Object.entries(status.configured).map(([key, value]) => (
                <View key={key} style={styles.row}>
                  <Text style={styles.rowLabel}>{LABELS[key]?.[language === 'en' ? 1 : 0] ?? key}</Text>
                  <Text style={[styles.rowValue, { color: value ? palette.positive : palette.warning }]}>
                    {value ? t('Konfigurerad', 'Configured') : t('Saknas', 'Missing')}
                  </Text>
                </View>
              ))}

              <Text style={styles.sectionTitle}>{t('Användare', 'Users')}</Text>
              <UserAdmin currentEmail={currentEmail} />

              <Text style={styles.sectionTitle}>{t('Marknad', 'Market')}</Text>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Stockholm</Text>
                <Text style={[styles.rowValue, { color: status.markets.stockholmOpen ? palette.positive : palette.textSecondary }]}>
                  {status.markets.stockholmOpen ? t('Öppen', 'Open') : t('Stängd', 'Closed')}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>USA</Text>
                <Text style={[styles.rowValue, { color: status.markets.usOpen ? palette.positive : palette.textSecondary }]}>
                  {status.markets.usOpen ? t('Öppen', 'Open') : t('Stängd', 'Closed')}
                </Text>
              </View>

              <Text style={styles.sectionTitle}>{t('Varningar senaste 14 dagarna', 'Alerts in the last 14 days')}</Text>
              {status.alerts ? (
                <>
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>{t('Skickade', 'Sent')}</Text>
                    <Text style={styles.rowValue}>{status.alerts.sent}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>{t('Misslyckade', 'Failed')}</Text>
                    <Text style={[styles.rowValue, status.alerts.failed > 0 && { color: palette.negative }]}>{status.alerts.failed}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>{t('Senaste', 'Latest')}</Text>
                    <Text style={styles.rowValue}>
                      {status.alerts.latest ? new Date(status.alerts.latest).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' }) : t('Ingen', 'None')}
                    </Text>
                  </View>
                </>
              ) : (
                <Text style={styles.sectionNote}>{t('Kräver servernyckeln för Supabase.', 'Requires the Supabase server key.')}</Text>
              )}

              <HintedTouchable
                style={[styles.action, running && styles.actionDisabled]}
                disabled={running}
                onPress={runDigest}
                accessibilityLabel={t('Kör dagens bevakning nu', 'Run today’s monitoring now')}
                hint={t('Kör varningsjobbet direkt, oavsett klockslag, för att kontrollera att kedjan från marknadsdata till e-post fungerar.', 'Runs the alert job immediately to verify the full market-data-to-email flow.')}
              >
                <Text style={styles.actionText}>{running ? t('Kör...', 'Running...') : t('Kör dagens bevakning nu', 'Run today’s monitoring now')}</Text>
              </HintedTouchable>
              <Text style={styles.sectionNote}>
                {t('Sjudagarsspärren gäller även här: bolag som redan gett en signal den här veckan skickas inte igen.', 'The seven-day cooldown also applies here: companies that already triggered a signal this week are not sent again.')}
              </Text>

              <Text style={styles.sectionTitle}>{t('Fungerar rekylläget?', 'Does the pullback model work?')}</Text>
              <RekylBacktestPanel />

              <Text style={styles.sectionTitle}>{t('Kursen efter rapport', 'Price after earnings')}</Text>
              <EarningsStudyPanel />
            </>
          ) : null}

          {message && <Text style={styles.message}>{message}</Text>}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: palette.borderStrong,
  },
  title: { color: palette.textPrimary, fontSize: 20, fontWeight: '700' },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: palette.textPrimary, fontSize: 20 },
  body: { padding: 20, paddingBottom: 48 },
  sectionTitle: {
    color: palette.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.1,
    textTransform: 'uppercase', marginTop: 22, marginBottom: 8,
  },
  sectionNote: { color: palette.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 8 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: palette.border,
  },
  rowLabel: { color: palette.textPrimary, fontSize: 13, flex: 1 },
  rowValue: { color: palette.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '600' },
  action: {
    marginTop: 24, minHeight: 44, borderRadius: 6, backgroundColor: palette.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  actionDisabled: { opacity: 0.55 },
  actionText: { color: palette.textStrong, fontSize: 13, fontWeight: '700' },
  message: { color: palette.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 16 },
});
