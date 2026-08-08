import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, SafeAreaView, StyleSheet, Switch, Text, View } from 'react-native';
import { HintedTouchable } from '@/components/HintedTouchable';
import { loadAlertPreferences, saveAlertPreferences } from '@/lib/alert-preferences';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors as palette } from '@/theme';

interface AlertSettingsProps { visible: boolean; onClose: () => void; }

export function AlertSettings({ visible, onClose }: AlertSettingsProps) {
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
      .catch(() => setMessage('Kunde inte läsa dina varningsinställningar. Kör först SQL-installationen för varningar i Supabase.'))
      .finally(() => setLoading(false));
  }, [visible]);

  const updatePreferences = async (nextDaily: boolean, nextInstant: boolean) => {
    if (saving) return;
    setSaving(true);
    setMessage(null);
    try {
      await saveAlertPreferences({ email_alerts_enabled: nextDaily, instant_alerts_enabled: nextInstant });
      setEnabled(nextDaily);
      setInstantEnabled(nextInstant);
      setMessage(nextInstant ? 'Snabbvarningar är aktiverade.' : nextDaily ? 'Dagliga varningar är aktiverade.' : 'E-postvarningar är avstängda.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Kunde inte spara inställningen.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>E-postvarningar</Text>
          <HintedTouchable style={styles.close} onPress={onClose} accessibilityLabel="Stäng varningsinställningar" hint="Stänger inställningarna för e-postvarningar."><Text style={styles.closeText}>✕</Text></HintedTouchable>
        </View>
        <View style={styles.body}>
          {!isSupabaseConfigured ? <Text style={styles.message}>E-postvarningar kräver Supabase-inloggning och personliga favoriter.</Text> : loading ? <ActivityIndicator color="#60a5fa" /> : <>
            <View style={styles.settingRow}>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>Daglig bevakning</Text>
                <Text style={styles.settingText}>Ett samlat e-postmeddelande efter börsens stängning när en favorit får köpläge eller riskvarning.</Text>
              </View>
              <Switch value={enabled} onValueChange={(next) => void updatePreferences(next, instantEnabled)} disabled={saving} trackColor={{ false: '#3b3b4d', true: '#2563eb' }} thumbColor="#fff" accessibilityLabel="Aktivera dagliga e-postvarningar" accessibilityHint="Slår på eller av daglig sammanfattning för din egen favoritlista." />
            </View>
            <View style={styles.settingRow}>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>Snabbvarningar</Text>
                <Text style={styles.settingText}>Direktmejl under börsens öppettider vid ett starkt köpläge eller en risksignal som kan kräva snabb uppmärksamhet.</Text>
              </View>
              <Switch value={instantEnabled} onValueChange={(next) => void updatePreferences(enabled, next)} disabled={saving} trackColor={{ false: '#3b3b4d', true: '#d94646' }} thumbColor="#fff" accessibilityLabel="Aktivera snabba e-postvarningar" accessibilityHint="Skickar bara högprioriterade köp- och risksignaler från din egen favoritlista." />
            </View>
            <View style={styles.note}><Text style={styles.noteText}>Samma aktie och signaltyp skickas högst en gång per sju dagar. Varningar är beslutsstöd, inte personlig investeringsrådgivning.</Text></View>
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
