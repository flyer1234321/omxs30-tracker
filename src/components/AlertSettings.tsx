import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, SafeAreaView, StyleSheet, Switch, Text, View } from 'react-native';
import { HintedTouchable } from '@/components/HintedTouchable';
import { loadAlertPreferences, saveAlertPreferences } from '@/lib/alert-preferences';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors as palette } from '@/theme';
import { useAppLanguage } from '@/components/AppLanguage';

interface AlertSettingsProps { visible: boolean; onClose: () => void; }

export function AlertSettings({ visible, onClose }: AlertSettingsProps) {
  const { t } = useAppLanguage();
  const [enabled, setEnabled] = useState(false);
  const [instantEnabled, setInstantEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !isSupabaseConfigured) return;
    setLoading(true);
    setMessage(null);
    void loadAlertPreferences()
      .then((preferences) => {
        setEnabled(preferences?.email_alerts_enabled ?? false);
        setInstantEnabled(preferences?.instant_alerts_enabled ?? false);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : t('Kunde inte läsa dina varningsinställningar.', 'Could not load your alert settings.')))
      .finally(() => setLoading(false));
  }, [t, visible]);

  const updatePreferences = async (nextDaily: boolean, nextInstant: boolean) => {
    if (saving) return;
    setSaving(true);
    setMessage(null);
    try {
      await saveAlertPreferences({ email_alerts_enabled: nextDaily, instant_alerts_enabled: nextInstant });
      setEnabled(nextDaily);
      setInstantEnabled(nextInstant);
      setMessage(nextInstant ? t('Snabbvarningar är aktiverade.', 'Instant alerts are enabled.') : nextDaily ? t('Dagliga varningar är aktiverade.', 'Daily alerts are enabled.') : t('E-postvarningar är avstängda.', 'Email alerts are disabled.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Kunde inte spara inställningen.', 'Could not save the setting.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('E-postvarningar', 'Email alerts')}</Text>
          <HintedTouchable style={styles.close} onPress={onClose} accessibilityLabel={t('Stäng varningsinställningar', 'Close alert settings')} hint={t('Stänger inställningarna för e-postvarningar.', 'Closes the email alert settings.')}><Text style={styles.closeText}>✕</Text></HintedTouchable>
        </View>
        <View style={styles.body}>
          {!isSupabaseConfigured ? <Text style={styles.message}>{t('E-postvarningar kräver Supabase-inloggning och personliga favoriter.', 'Email alerts require Supabase sign-in and personal favourites.')}</Text> : loading ? <ActivityIndicator color="#60a5fa" /> : <>
            <View style={styles.settingRow}>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>{t('Daglig bevakning', 'Daily monitoring')}</Text>
                <Text style={styles.settingText}>{t('Ett samlat e-postmeddelande efter börsens stängning när en favorit får köpläge eller riskvarning.', 'One digest after the market closes when a favourite receives a buy signal or risk warning.')}</Text>
              </View>
              <Switch value={enabled} onValueChange={(next) => void updatePreferences(next, instantEnabled)} disabled={saving} trackColor={{ false: '#3b3b4d', true: '#2563eb' }} thumbColor="#fff" accessibilityLabel={t('Aktivera dagliga e-postvarningar', 'Enable daily email alerts')} accessibilityHint={t('Slår på eller av daglig sammanfattning för din egen favoritlista.', 'Turns the daily digest for your personal favourites on or off.')} />
            </View>
            <View style={styles.settingRow}>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>{t('Snabbvarningar', 'Instant alerts')}</Text>
                <Text style={styles.settingText}>{t('Direktmejl under börsens öppettider vid ett starkt köpläge eller en risksignal som kan kräva snabb uppmärksamhet.', 'Immediate email during market hours for a strong buy signal or a risk signal that may require prompt attention.')}</Text>
              </View>
              <Switch value={instantEnabled} onValueChange={(next) => void updatePreferences(enabled, next)} disabled={saving} trackColor={{ false: '#3b3b4d', true: '#d94646' }} thumbColor="#fff" accessibilityLabel={t('Aktivera snabba e-postvarningar', 'Enable instant email alerts')} accessibilityHint={t('Skickar bara högprioriterade köp- och risksignaler från din egen favoritlista.', 'Sends only high-priority buy and risk signals from your personal favourites.')} />
            </View>
            <View style={styles.note}><Text style={styles.noteText}>{t('Samma aktie och signaltyp skickas högst en gång per sju dagar. Varningar är beslutsstöd, inte personlig investeringsrådgivning.', 'The same stock and signal type is sent at most once every seven days. Alerts are decision support, not personal investment advice.')}</Text></View>
            {message && <Text style={styles.message}>{message}</Text>}
          </>}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: palette.border },
  title: { color: palette.textPrimary, fontSize: 20, fontWeight: '700' }, close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }, closeText: { color: palette.textSecondary, fontSize: 20 },
  body: { padding: 20 }, settingRow: { flexDirection: 'row', gap: 20, alignItems: 'center', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 8, padding: 16, marginBottom: 12 }, settingCopy: { flex: 1 },
  settingTitle: { color: palette.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 5 }, settingText: { color: palette.textSecondary, fontSize: 13, lineHeight: 19 },
  note: { borderLeftWidth: 2, borderLeftColor: palette.accent, marginTop: 16, paddingLeft: 12 }, noteText: { color: palette.textMuted, fontSize: 12, lineHeight: 18 }, message: { color: palette.accent, fontSize: 13, lineHeight: 19, marginTop: 16 },
});
