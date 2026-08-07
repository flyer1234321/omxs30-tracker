import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HintedTouchable } from '@/components/HintedTouchable';
import { authenticatedFetch } from '@/lib/auth-client';
import { colors as palette } from '@/theme';

interface AdminStatus {
  configured: Record<string, boolean>;
  access: { allowedEmails: number; adminEmails: number };
  markets: { stockholmOpen: boolean; usOpen: boolean };
  alerts: { sent: number; failed: number; pending: number; latest: string | null } | null;
  checkedAt: string;
}

const LABELS: Record<string, string> = {
  magicLink: 'Inloggning med e-postlänk',
  passwordLogin: 'Inloggning med lösenord',
  openAi: 'AI-skriven analystext',
  supabaseServiceKey: 'Servernyckel för Supabase',
  resend: 'E-postutskick via Resend',
  cronSecret: 'Hemlighet för schemalagda jobb',
  appUrl: 'Publik adress (APP_URL)',
};

interface AdminPanelProps {
  visible: boolean;
  onClose: () => void;
}

export function AdminPanel({ visible, onClose }: AdminPanelProps) {
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await authenticatedFetch('/api/admin/status');
      if (!response.ok) throw new Error('Kunde inte läsa statusen.');
      setStatus(await response.json() as AdminStatus);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Kunde inte läsa statusen.');
    } finally {
      setLoading(false);
    }
  }, []);

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
        ? `Klart. ${data.sent ?? 0} mejl skickade till ${data.users ?? 0} bevakande användare.`
        : data.error || 'Jobbet kunde inte köras.');
      void load();
    } catch {
      setMessage('Kunde inte köra jobbet.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>Administration</Text>
          <HintedTouchable style={styles.close} onPress={onClose} accessibilityLabel="Stäng administrationsvyn" hint="Stänger administrationsvyn.">
            <Text style={styles.closeText}>✕</Text>
          </HintedTouchable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {loading && !status ? <ActivityIndicator color={palette.accent} /> : status ? (
            <>
              <Text style={styles.sectionTitle}>Konfiguration</Text>
              <Text style={styles.sectionNote}>
                Visar bara om värdena är satta, aldrig vad de innehåller.
              </Text>
              {Object.entries(status.configured).map(([key, value]) => (
                <View key={key} style={styles.row}>
                  <Text style={styles.rowLabel}>{LABELS[key] ?? key}</Text>
                  <Text style={[styles.rowValue, { color: value ? palette.positive : palette.warning }]}>
                    {value ? 'Konfigurerad' : 'Saknas'}
                  </Text>
                </View>
              ))}

              <Text style={styles.sectionTitle}>Åtkomst</Text>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Godkända e-postadresser</Text>
                <Text style={styles.rowValue}>{status.access.allowedEmails || 'Alla (ingen lista satt)'}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Administratörer</Text>
                <Text style={styles.rowValue}>{status.access.adminEmails}</Text>
              </View>

              <Text style={styles.sectionTitle}>Marknad</Text>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Stockholm</Text>
                <Text style={[styles.rowValue, { color: status.markets.stockholmOpen ? palette.positive : palette.textSecondary }]}>
                  {status.markets.stockholmOpen ? 'Öppen' : 'Stängd'}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>USA</Text>
                <Text style={[styles.rowValue, { color: status.markets.usOpen ? palette.positive : palette.textSecondary }]}>
                  {status.markets.usOpen ? 'Öppen' : 'Stängd'}
                </Text>
              </View>

              <Text style={styles.sectionTitle}>Varningar senaste 14 dagarna</Text>
              {status.alerts ? (
                <>
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Skickade</Text>
                    <Text style={styles.rowValue}>{status.alerts.sent}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Misslyckade</Text>
                    <Text style={[styles.rowValue, status.alerts.failed > 0 && { color: palette.negative }]}>{status.alerts.failed}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Senaste</Text>
                    <Text style={styles.rowValue}>
                      {status.alerts.latest ? new Date(status.alerts.latest).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' }) : 'Ingen'}
                    </Text>
                  </View>
                </>
              ) : (
                <Text style={styles.sectionNote}>Kräver servernyckeln för Supabase.</Text>
              )}

              <HintedTouchable
                style={[styles.action, running && styles.actionDisabled]}
                disabled={running}
                onPress={runDigest}
                accessibilityLabel="Kör dagens bevakning nu"
                hint="Kör varningsjobbet direkt, oavsett klockslag, för att kontrollera att kedjan från marknadsdata till e-post fungerar."
              >
                <Text style={styles.actionText}>{running ? 'Kör...' : 'Kör dagens bevakning nu'}</Text>
              </HintedTouchable>
              <Text style={styles.sectionNote}>
                Sjudagarsspärren gäller även här: bolag som redan gett en signal den här veckan skickas inte igen.
              </Text>
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
