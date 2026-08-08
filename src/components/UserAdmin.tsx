import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { HintedTouchable } from '@/components/HintedTouchable';
import { authenticatedFetch } from '@/lib/auth-client';
import { colors as palette } from '@/theme';
import { useAppLanguage } from '@/components/AppLanguage';

interface AppUser {
  email: string;
  isAdmin: boolean;
  canUseAi: boolean;
  aiDailyLimit: number;
  createdAt: string | null;
}

/**
 * Behörigheter styrs från tabellen app_users. Administratörer angivna i
 * miljövariabeln APP_ADMIN_EMAILS visas också, men går inte att redigera
 * härifrån - de är den utväg som gör att den sista administratören inte kan
 * låsa ut sig själv genom ett felklick.
 */
export function UserAdmin({ currentEmail }: { currentEmail: string | null }) {
  const { t } = useAppLanguage();
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
      if (!response.ok) throw new Error(payload.error || t('Kunde inte läsa användarlistan.', 'Could not load the user list.'));
      setUsers(payload.users ?? []);
      setEnvAdmins(payload.envAdmins ?? []);
      setDatabaseAvailable(payload.databaseAvailable !== false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Kunde inte läsa användarlistan.', 'Could not load the user list.'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const save = async (email: string, changes: { isAdmin: boolean; canUseAi: boolean; aiDailyLimit: number }) => {
    setBusyEmail(email);
    setMessage(null);
    try {
      const response = await authenticatedFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, ...changes }),
      });
      const payload = await response.json() as { user?: AppUser; error?: string; selfProtected?: boolean };
      if (!response.ok) throw new Error(payload.error || t('Kunde inte spara.', 'Could not save.'));
      if (payload.selfProtected) {
        setMessage(t('Du kan inte ta bort dina egna administratörsrättigheter.', 'You cannot remove your own administrator rights.'));
      }
      setNewEmail('');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Kunde inte spara.', 'Could not save.'));
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
      if (!response.ok) throw new Error(payload.error || t('Kunde inte ta bort användaren.', 'Could not remove the user.'));
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Kunde inte ta bort användaren.', 'Could not remove the user.'));
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
          {t(
            'Tabellen app_users kunde inte läsas. Behörigheterna styrs tills vidare av APP_ALLOWED_EMAILS. Se docs/supabase-users-setup.md.',
            'The app_users table could not be read. Access is currently controlled by APP_ALLOWED_EMAILS. See docs/supabase-users-setup.md.',
          )}
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
          onSubmitEditing={() => { if (newEmail.trim()) void save(newEmail.trim(), { isAdmin: false, canUseAi: false, aiDailyLimit: 5 }); }}
          accessibilityLabel={t('E-postadress för ny användare', 'Email address for new user')}
          accessibilityHint={t('Lägger till adressen i listan över godkända konton. Användaren loggar sedan in med en e-postlänk.', 'Adds the address to the approved accounts. The user then signs in with an email link.')}
        />
        <HintedTouchable
          style={[styles.addButton, !newEmail.trim() && styles.disabled]}
          disabled={!newEmail.trim() || busyEmail != null}
          onPress={() => void save(newEmail.trim(), { isAdmin: false, canUseAi: false, aiDailyLimit: 5 })}
          accessibilityLabel={t('Lägg till användare', 'Add user')}
          hint={t('Ger adressen åtkomst. Något lösenord behövs inte - användaren loggar in med en engångslänk till sin e-post.', 'Grants access to the address. No password is required; the user signs in with a one-time email link.')}
        >
          <Text style={styles.addButtonText}>{t('Lägg till', 'Add')}</Text>
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
                <Text style={styles.selfTag}>{t('du', 'you')}</Text>
              ) : (
                <HintedTouchable
                  style={styles.remove}
                  disabled={busy}
                  onPress={() => void remove(user.email)}
                  accessibilityLabel={`${t('Ta bort', 'Remove')} ${user.email}`}
                  hint={t('Drar in åtkomsten. Inloggningskontot och favoritlistan finns kvar om personen läggs till igen.', 'Revokes access. The sign-in account and favorites remain if the person is added again.')}
                >
                  <Text style={styles.removeText}>{t('Ta bort', 'Remove')}</Text>
                </HintedTouchable>
              )}
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{t('Administratör', 'Administrator')}</Text>
              <Switch
                value={user.isAdmin}
                disabled={busy || isSelf}
                onValueChange={(next) => void save(user.email, { isAdmin: next, canUseAi: user.canUseAi, aiDailyLimit: user.aiDailyLimit })}
                trackColor={{ false: palette.borderStrong, true: palette.accent }}
                thumbColor={palette.textStrong}
                accessibilityLabel={`Administratörsrättigheter för ${user.email}`}
              />
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{t('AI-analys', 'AI analysis')}</Text>
              <Switch
                value={user.canUseAi}
                disabled={busy}
                onValueChange={(next) => void save(user.email, { isAdmin: user.isAdmin, canUseAi: next, aiDailyLimit: user.aiDailyLimit || 5 })}
                trackColor={{ false: palette.borderStrong, true: palette.accent }}
                thumbColor={palette.textStrong}
                accessibilityLabel={`Tillgång till AI-analys för ${user.email}`}
              />
            </View>

            {user.canUseAi && (
              <View style={styles.quotaRow}>
                <View>
                  <Text style={styles.toggleLabel}>{t('Max AI-anrop per dag', 'Maximum AI requests per day')}</Text>
                  <Text style={styles.quotaHint}>{user.aiDailyLimit === 0 ? t('Obegränsat', 'Unlimited') : `${user.aiDailyLimit} ${t('betalda analyser', 'paid analyses')}`}</Text>
                </View>
                <View style={styles.stepper}>
                  <HintedTouchable
                    style={styles.stepperButton}
                    disabled={busy}
                    onPress={() => void save(user.email, {
                      isAdmin: user.isAdmin,
                      canUseAi: user.canUseAi,
                      aiDailyLimit: Math.max(0, user.aiDailyLimit - 1),
                    })}
                    accessibilityLabel={`Minska AI-gränsen för ${user.email}`}
                    hint="Minskar antalet betalda AI-analyser som kontot får skapa per dag. Noll betyder obegränsat."
                  >
                    <Text style={styles.stepperText}>−</Text>
                  </HintedTouchable>
                  <Text style={styles.stepperValue}>{user.aiDailyLimit === 0 ? '∞' : user.aiDailyLimit}</Text>
                  <HintedTouchable
                    style={styles.stepperButton}
                    disabled={busy}
                    onPress={() => void save(user.email, {
                      isAdmin: user.isAdmin,
                      canUseAi: user.canUseAi,
                      aiDailyLimit: Math.min(100, user.aiDailyLimit + 1),
                    })}
                    accessibilityLabel={`Öka AI-gränsen för ${user.email}`}
                    hint="Ökar antalet betalda AI-analyser som kontot får skapa per dag."
                  >
                    <Text style={styles.stepperText}>+</Text>
                  </HintedTouchable>
                </View>
              </View>
            )}
          </View>
        );
      })}

      {users.length === 0 && databaseAvailable && (
        <Text style={styles.note}>
          {t('Inga användare i tabellen ännu. Så länge den är tom gäller APP_ALLOWED_EMAILS, så ingen blir utelåst av att du lägger till den första.', 'There are no users in the table yet. While it is empty, APP_ALLOWED_EMAILS applies, so adding the first user will not lock anyone out.')}
        </Text>
      )}

      {envAdmins.length > 0 && (
        <Text style={styles.note}>
          {t('Fast angivna administratörer', 'Fixed administrators')}: {envAdmins.join(', ')}. {t('De styrs av APP_ADMIN_EMAILS och kan inte ändras här.', 'They are controlled by APP_ADMIN_EMAILS and cannot be changed here.')}
        </Text>
      )}

      <Text style={styles.note}>
        {t('AI-analysen är det enda som kostar pengar per anrop. Dagsgränsen räknar bara nya AI-anrop, inte cachade svar. Noll visas som ∞ och betyder obegränsat. Utan AI-behörighet visas den regelbaserade analysen.', 'AI analysis is the only feature that costs money per request. The daily limit counts only new AI requests, not cached responses. Zero is shown as ∞ and means unlimited. Without AI access, the rule-based analysis is shown.')}
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
  quotaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, marginTop: 5, borderTopWidth: 1, borderTopColor: palette.border },
  quotaHint: { color: palette.textMuted, fontSize: 10, marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: palette.borderStrong, borderRadius: 6, overflow: 'hidden' },
  stepperButton: { width: 34, height: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surfaceAlt },
  stepperText: { color: palette.accent, fontSize: 18, fontWeight: '700' },
  stepperValue: { minWidth: 38, textAlign: 'center', color: palette.textPrimary, fontSize: 12, fontVariant: ['tabular-nums'] },
  note: { color: palette.textMuted, fontSize: 11, lineHeight: 16, marginTop: 10 },
  message: { color: palette.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 12 },
});
