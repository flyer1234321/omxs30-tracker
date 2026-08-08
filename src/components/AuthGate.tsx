import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authenticatedFetch, signOut as endSession } from '@/lib/auth-client';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { HintedTouchable } from '@/components/HintedTouchable';
import { colors as palette } from '@/theme';

const EMAIL_STORAGE_KEY = '@login_email';

/** Startanropet fick tidigare snurra hur länge som helst om nätet hängde. */
const STATUS_TIMEOUT_MS = 10_000;

/** Hur länge knappen är låst efter ett utskick, i takt med serverns spärr. */
const RESEND_COOLDOWN_SECONDS = 60;

interface AuthState {
  signOut: () => Promise<void>;
  isAdmin: boolean;
  canUseAi: boolean;
  email: string | null;
}

const AuthContext = createContext<AuthState>({ signOut: async () => {}, isAdmin: false, canUseAi: false, email: null });

export function useAppAuth() {
  return useContext(AuthContext);
}

interface AuthStatus {
  configured: boolean;
  authenticated: boolean;
  magicLinkAvailable: boolean;
  passwordLoginAvailable: boolean;
  email: string | null;
  isAdmin: boolean;
  canUseAi: boolean;
}

interface Notice {
  text: string;
  tone: 'info' | 'error';
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);

  // Sparad adress slipper skrivas in varje gång.
  useEffect(() => {
    void AsyncStorage.getItem(EMAIL_STORAGE_KEY)
      .then((stored) => { if (stored && activeRef.current) setEmail(stored); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const readStatus = useCallback(async (): Promise<AuthStatus | null> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS);
    try {
      const response = await authenticatedFetch('/api/auth', { signal: controller.signal });
      const data = await response.json() as Partial<AuthStatus>;
      return {
        configured: Boolean(data.configured),
        authenticated: Boolean(data.authenticated),
        magicLinkAvailable: Boolean(data.magicLinkAvailable),
        passwordLoginAvailable: Boolean(data.passwordLoginAvailable),
        email: data.email ?? null,
        isAdmin: Boolean(data.isAdmin),
        canUseAi: Boolean(data.canUseAi),
      };
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  /**
   * Tidigare kastades man ut till inloggningsrutan helt utan förklaring när
   * kontot saknade åtkomst eller när statusanropet fallerade. Nu skiljs de två
   * fallen åt, och båda säger vad som hände.
   */
  const syncSession = useCallback(async (hasSupabaseSession: boolean) => {
    try {
      const next = await readStatus();
      if (!activeRef.current || !next) return;
      setStatus(next);

      if (!next.authenticated && hasSupabaseSession) {
        setNotice({
          tone: 'error',
          text: 'Kontot är inloggat men saknar åtkomst till den här screenern. Be administratören lägga till adressen i listan över godkända konton.',
        });
        await supabase?.auth.signOut();
      }
    } catch (error) {
      if (!activeRef.current) return;
      const aborted = error instanceof Error && error.name === 'AbortError';
      setStatus((current) => current ?? {
        configured: true, authenticated: false, magicLinkAvailable: isSupabaseConfigured,
        passwordLoginAvailable: !isSupabaseConfigured, email: null, isAdmin: false, canUseAi: false,
      });
      setNotice({
        tone: 'error',
        text: aborted
          ? 'Inloggningstjänsten svarade inte. Kontrollera anslutningen och försök igen.'
          : 'Kunde inte kontakta inloggningstjänsten.',
      });
    }
  }, [readStatus]);

  useEffect(() => {
    void syncSession(false);
    if (!supabase) return;

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      // TOKEN_REFRESHED ger ingen ny behörighet och behöver inte kontrolleras om.
      if (event === 'TOKEN_REFRESHED') return;
      void syncSession(Boolean(session));
    });
    return () => listener.subscription.unsubscribe();
  }, [syncSession]);

  const submitPassword = async () => {
    if (!password || submitting) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const response = await authenticatedFetch('/api/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
      });
      const data = await response.json() as { authenticated?: boolean; error?: string; retryAfterSeconds?: number; isAdmin?: boolean };
      if (data.authenticated) {
        setPassword('');
        setStatus((current) => ({
          configured: true,
          magicLinkAvailable: current?.magicLinkAvailable ?? false,
          passwordLoginAvailable: true,
          authenticated: true,
          email: null,
          isAdmin: Boolean(data.isAdmin),
          canUseAi: true,
        }));
      } else {
        setNotice({
          tone: 'error',
          text: data.retryAfterSeconds
            ? `${data.error} Vänta cirka ${Math.ceil(data.retryAfterSeconds / 60)} minuter.`
            : data.error || 'Inloggningen misslyckades.',
        });
      }
    } catch {
      setNotice({ tone: 'error', text: 'Kunde inte kontakta inloggningstjänsten.' });
    } finally {
      setSubmitting(false);
    }
  };

  const sendMagicLink = async () => {
    const trimmed = email.trim();
    if (!trimmed || submitting || cooldown > 0) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const response = await authenticatedFetch('/api/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await response.json() as { sent?: boolean; error?: string; retryAfterSeconds?: number };
      if (data.sent) {
        void AsyncStorage.setItem(EMAIL_STORAGE_KEY, trimmed).catch(() => {});
        setCooldown(RESEND_COOLDOWN_SECONDS);
        setNotice({
          tone: 'info',
          text: 'Länken är skickad. Öppna den i den här webbläsaren, så loggas du in automatiskt. Kolla skräpposten om den dröjer.',
        });
      } else {
        if (data.retryAfterSeconds) setCooldown(Math.min(data.retryAfterSeconds, 300));
        setNotice({ tone: 'error', text: data.error || 'Kunde inte skicka inloggningslänken.' });
      }
    } catch {
      setNotice({ tone: 'error', text: 'Kunde inte kontakta inloggningstjänsten.' });
    } finally {
      setSubmitting(false);
    }
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    await endSession();
    setStatus((current) => (current ? { ...current, authenticated: false, isAdmin: false, canUseAi: false, email: null } : current));
    setNotice({ tone: 'info', text: 'Du är utloggad.' });
  };

  if (!status) {
    return <View style={styles.loading}><ActivityIndicator color={palette.accent} /></View>;
  }

  if (status.authenticated) {
    return (
      <AuthContext.Provider value={{ signOut, isAdmin: status.isAdmin, canUseAi: status.canUseAi, email: status.email }}>
        {children}
      </AuthContext.Provider>
    );
  }

  const showMagicLink = status.configured && status.magicLinkAvailable;
  const showPassword = status.configured && status.passwordLoginAvailable;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.card}>
        <Text style={styles.title}>OMX30 Screener</Text>

        {!status.configured && (
          <Text style={styles.error}>
            Inloggning är inte konfigurerad. Lägg till antingen `EXPO_PUBLIC_SUPABASE_URL` och
            `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, eller `APP_ACCESS_PASSWORD` och `APP_SESSION_SECRET`.
          </Text>
        )}

        {showMagicLink && (
          <View style={styles.section}>
            <Text style={styles.subtitle}>Ange din e-postadress för en säker inloggningslänk.</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              keyboardType="email-address"
              onSubmitEditing={sendMagicLink}
              placeholder="E-postadress"
              placeholderTextColor={palette.textSecondary}
              accessibilityLabel="E-postadress för inloggning"
              accessibilityHint="En säker engångslänk skickas till en godkänd e-postadress."
            />
            <HintedTouchable
              style={[styles.button, (submitting || cooldown > 0) && styles.buttonDisabled]}
              disabled={submitting || cooldown > 0}
              onPress={sendMagicLink}
              accessibilityLabel="Skicka inloggningslänk"
              hint="Skickar en säker engångslänk till den angivna godkända e-postadressen."
            >
              <Text style={styles.buttonText}>
                {submitting ? 'Skickar...' : cooldown > 0 ? `Skicka igen om ${cooldown} s` : 'Skicka inloggningslänk'}
              </Text>
            </HintedTouchable>
          </View>
        )}

        {showMagicLink && showPassword && (
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>eller</Text>
            <View style={styles.dividerLine} />
          </View>
        )}

        {showPassword && (
          <View style={styles.section}>
            <Text style={styles.subtitle}>
              {showMagicLink
                ? 'Kommer länken inte fram går det att logga in med åtkomstlösenordet.'
                : 'Ange åtkomstlösenordet för att öppna din privata screener.'}
            </Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              onSubmitEditing={submitPassword}
              placeholder="Åtkomstlösenord"
              placeholderTextColor={palette.textSecondary}
              accessibilityLabel="Åtkomstlösenord"
              accessibilityHint="Ange lösenordet som administratören har valt för den privata screenern."
            />
            <HintedTouchable
              style={[styles.button, submitting && styles.buttonDisabled]}
              disabled={submitting}
              onPress={submitPassword}
              accessibilityLabel="Logga in"
              hint="Kontrollerar åtkomstlösenordet och öppnar screenern."
            >
              <Text style={styles.buttonText}>{submitting ? 'Kontrollerar...' : 'Logga in'}</Text>
            </HintedTouchable>
          </View>
        )}

        {notice && <Text style={notice.tone === 'error' ? styles.error : styles.message}>{notice.text}</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg, justifyContent: 'center', padding: 20 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.bg },
  card: {
    width: '100%', maxWidth: 400, alignSelf: 'center', backgroundColor: palette.surface,
    borderWidth: 1, borderColor: palette.borderStrong, borderRadius: 8, padding: 24,
  },
  title: { color: palette.textPrimary, fontSize: 24, fontWeight: '700', marginBottom: 16 },
  section: { marginBottom: 4 },
  subtitle: { color: palette.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 14 },
  input: {
    color: palette.textPrimary, backgroundColor: palette.bg, borderWidth: 1, borderColor: palette.borderStrong,
    borderRadius: 6, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15,
  },
  button: { alignItems: 'center', backgroundColor: palette.accent, borderRadius: 6, marginTop: 12, paddingVertical: 12 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: palette.textStrong, fontSize: 14, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: palette.border },
  dividerText: { color: palette.textSecondary, fontSize: 12 },
  message: { color: palette.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 16 },
  error: { color: palette.negative, fontSize: 13, lineHeight: 19, marginTop: 16 },
});
