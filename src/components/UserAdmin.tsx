import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { HintedTouchable } from '@/components/HintedTouchable';
import { authenticatedFetch } from '@/lib/auth-client';
import { colors as palette } from '@/theme';

interface AppUser {
  email: string;
  isAdmin: boolean;
  canUseAi: boolean;
  createdAt: string | null;
}

/**
 * Behörigheter styrs från tabellen app_users. Administratörer angivna i
 * miljövariabeln APP_ADMIN_EMAILS visas också, men går inte att redigera
 * härifrån - de är den utväg som gör att den sista administratören inte kan
 * låsa ut sig själv genom ett felklick.
 */
export function UserAdmin({ currentEmail }: { currentEmail: string | null }) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [envAdmins, setEnvAdmins] = useState<string[]>([]);
  const [databaseAvailable, setDatabaseAvailable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await authenticatedFetch('/api/admin/users');
      const payload = await response.json() as { users?: AppUser[]; envAdmins?: string[]; databaseAvailable?: boolean; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Kunde inte läsa användarlistan.');
      setUsers(payload.users ?? []);
      setEnvAdmins(payload.envAdmins ?? []);
      setDatabaseAvailable(payload.databaseAvailable !== false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Kunde inte läsa användarlistan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async (email: string, changes: { isAdmin: boolean; canUseAi: boolean }) => {
    setBusyEmail(email);
    setMessage(null);
    try {
      const response = await authenticatedFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, ...changes }),
      });
      const payload = await response.json() as { user?: AppUser; error?: string; selfProtected?: boolean };
      if (!response.ok) throw new Error(payload.error || 'Kunde inte spara.');
      if (payload.selfProtected) {
        setMessage('Du kan inte ta bort dina egna administratörsrättigheter.');
      }
      setNewEmail('');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Kunde inte spara.');
    } finally {
      setBusyEmail(null);
    }
  };

  const remove = async (email: string) => {
    setBusyEmail(email);
    setMessage(null);
    try {
      const response = await authenticatedFetch(`/api/admin/users?email=${encodeURIComponent(email)}`, { method: 'DELETE' });
      const payload = await response.json() as { removed?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Kunde inte ta bort användaren.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Kunde inte ta bort användaren.');
    } finally {
      setBusyEmail(null);
    }
  };

  if (loading && users.length === 0) {
    return <View style={styles.loading}><ActivityIndicator color={palette.accent} /></View>;
  }

  return (
    <View>
      {!databaseAvailable && (
        <Text style={styles.warning}>
          Tabellen app_users kunde inte läsas. Behörigheterna styrs tills vidare av APP_ALLOWED_EMAILS.
          Se docs/supabase-users-setup.md.
        </Text>
      )}

      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          value={newEmail}
          onChangeText={setNewEmail}
          placeholder="ny.anvandare@example.com"
          placeholderTextColor={palette.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          onSubmitEditing={() => { if (newEmail.trim()) void save(newEmail.trim(), { isAdmin: false, canUseAi: false }); }}
          accessibilityLabel="E-postadress för ny användare"
          accessibilityHint="Lägger till adressen i listan över godkända konton. Användaren loggar sedan in med en e-postlänk."
        />
        <HintedTouchable
          style={[styles.addButton, !newEmail.trim() && styles.disabled]}
          disabled={!newEmail.trim() || busyEmail != null}
          onPress={() => void save(newEmail.trim(), { isAdmin: false, canUseAi: false })}
          accessibilityLabel="Lägg till användare"
          hint="Ger adressen åtkomst. Något lösenord behövs inte - användaren loggar in med en engångslänk till sin e-post."
        >
          <Text style={styles.addButtonText}>Lägg till</Text>
        </HintedTouchable>
      </View>

      {users.map((user) => {
        const isSelf = currentEmail != null && currentEmail === user.email;
        const busy = busyEmail === user.email;

        return (
          <View key={user.email} style={styles.user}>
            <View style={styles.userHeader}>
              <Text style={styles.email} numberOfLines={1}>{user.email}</Text>
              {isSelf ? (
                <Text style={styles.selfTag}>du</Text>
              ) : (
                <HintedTouchable
                  style={styles.remove}
                  disabled={busy}
                  onPress={() => void remove(user.email)}
                  accessibilityLabel={`Ta bort ${user.email}`}
                  hint="Drar in åtkomsten. Inloggningskontot och favoritlistan finns kvar om personen läggs till igen."
                >
                  <Text style={styles.removeText}>Ta bort</Text>
                </HintedTouchable>
              )}
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Administratör</Text>
              <Switch
                value={user.isAdmin}
                disabled={busy || isSelf}
                onValueChange={(next) => void save(user.email, { isAdmin: next, canUseAi: user.canUseAi })}
                trackColor={{ false: palette.borderStrong, true: palette.accent }}
                thumbColor={palette.textStrong}
                accessibilityLabel={`Administratörsrättigheter för ${user.email}`}
              />
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>AI-analys</Text>
              <Switch
                value={user.canUseAi}
                disabled={busy}
                onValueChange={(next) => void save(user.email, { isAdmin: user.isAdmin, canUseAi: next })}
                trackColor={{ false: palette.borderStrong, true: palette.accent }}
                thumbColor={palette.textStrong}
                accessibilityLabel={`Tillgång till AI-analys för ${user.email}`}
              />
            </View>
          </View>
        );
      })}

      {users.length === 0 && databaseAvailable && (
        <Text style={styles.note}>
          Inga användare i tabellen ännu. Så länge den är tom gäller APP_ALLOWED_EMAILS, så ingen blir utelåst
          av att du lägger till den första.
        </Text>
      )}

      {envAdmins.length > 0 && (
        <Text style={styles.note}>
          Fast angivna administratörer: {envAdmins.join(', ')}. De styrs av APP_ADMIN_EMAILS och kan inte ändras här.
        </Text>
      )}

      <Text style={styles.note}>
        AI-analysen är det enda som kostar pengar per anrop. Användare utan den behörigheten får den regelbaserade
        analysen i stället för ett felmeddelande.
      </Text>

      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { minHeight: 80, justifyContent: 'center', alignItems: 'center' },
  warning: { color: palette.warning, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  input: {
    flex: 1, color: palette.textPrimary, backgroundColor: palette.surface,
    borderWidth: 1, borderColor: palette.borderStrong, borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13,
  },
  addButton: {
    paddingHorizontal: 14, justifyContent: 'center', borderRadius: 6,
    backgroundColor: palette.accent,
  },
  addButtonText: { color: palette.textStrong, fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  user: {
    borderWidth: 1, borderColor: palette.border, borderRadius: 8,
    padding: 12, marginBottom: 8, backgroundColor: palette.surface,
  },
  userHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 },
  email: { color: palette.textPrimary, fontSize: 13, fontWeight: '600', flex: 1 },
  selfTag: { color: palette.textMuted, fontSize: 11, fontStyle: 'italic' },
  remove: { paddingVertical: 4, paddingHorizontal: 8 },
  removeText: { color: palette.negative, fontSize: 12, fontWeight: '600' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 },
  toggleLabel: { color: palette.textSecondary, fontSize: 12 },
  note: { color: palette.textMuted, fontSize: 11, lineHeight: 16, marginTop: 10 },
  message: { color: palette.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 12 },
});
