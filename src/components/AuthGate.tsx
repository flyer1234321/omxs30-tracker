import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authenticatedFetch, signOut as endSession } from '@/lib/auth-client';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { HintedTouchable } from '@/components/HintedTouchable';
import { useAppLanguage } from '@/components/AppLanguage';
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
  const { language, toggleLanguage, t } = useAppLanguage();
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
          text: t('Kontot är inloggat men saknar åtkomst till den här screenern. Be administratören lägga till adressen i listan över godkända konton.', 'The account is signed in but does not have access to this screener. Ask the administrator to add the address to the approved accounts.'),
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
          ? t('Inloggningstjänsten svarade inte. Kontrollera anslutningen och försök igen.', 'The sign-in service did not respond. Check your connection and try again.')
          : t('Kunde inte kontakta inloggningstjänsten.', 'Could not contact the sign-in service.'),
      });
    }
  }, [readStatus, t]);

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
            ? `${data.error} ${t('Vänta cirka', 'Wait approximately')} ${Math.ceil(data.retryAfterSeconds / 60)} ${t('minuter.', 'minutes.')}`
            : data.error || t('Inloggningen misslyckades.', 'Sign-in failed.'),
        });
      }
    } catch {
      setNotice({ tone: 'error', text: t('Kunde inte kontakta inloggningstjänsten.', 'Could not contact the sign-in service.') });
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
          text: t('Länken är skickad. Öppna den i den här webbläsaren, så loggas du in automatiskt. Kolla skräpposten om den dröjer.', 'The link has been sent. Open it in this browser to sign in automatically. Check your spam folder if it is delayed.'),
        });
      } else {
        if (data.retryAfterSeconds) setCooldown(Math.min(data.retryAfterSeconds, 300));
        setNotice({ tone: 'error', text: data.error || t('Kunde inte skicka inloggningslänken.', 'Could not send the sign-in link.') });
      }
    } catch {
      setNotice({ tone: 'error', text: t('Kunde inte kontakta inloggningstjänsten.', 'Could not contact the sign-in service.') });
    } finally {
      setSubmitting(false);
    }
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    await endSession();
    setStatus((current) => (current ? { ...current, authenticated: false, isAdmin: false, canUseAi: false, email: null } : current));
    setNotice({ tone: 'info', text: t('Du är utloggad.', 'You are signed out.') });
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
        <View style={styles.titleRow}>
          <Text style={styles.title}>OMX30 Screener</Text>
          <HintedTouchable style={styles.languageButton} onPress={toggleLanguage} accessibilityLabel={t('Byt språk till engelska', 'Switch language to Swedish')} hint={t('Visar inloggningen på engelska.', 'Shows the sign-in page in Swedish.')}>
            <Text style={styles.languageButtonText}>{language === 'sv' ? 'English' : 'Svenska'}</Text>
          </HintedTouchable>
        </View>

        {!status.configured && (
          <Text style={styles.error}>
            {t('Inloggning är inte konfigurerad. Lägg till antingen Supabase-variablerna eller lösenordsvariablerna i miljöinställningarna.', 'Sign-in is not configured. Add either the Supabase variables or the password variables to the environment settings.')}
          </Text>
        )}

        {showMagicLink && (
          <View style={styles.section}>
            <Text style={styles.subtitle}>{t('Ange din e-postadress för en säker inloggningslänk.', 'Enter your email address to receive a secure sign-in link.')}</Text>
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
              placeholder={t('E-postadress', 'Email address')}
              placeholderTextColor={palette.textSecondary}
              accessibilityLabel={t('E-postadress för inloggning', 'Email address for sign-in')}
              accessibilityHint={t('En säker engångslänk skickas till en godkänd e-postadress.', 'A secure one-time link is sent to an approved email address.')}
            />
            <HintedTouchable
              style={[styles.button, (submitting || cooldown > 0) && styles.buttonDisabled]}
              disabled={submitting || cooldown > 0}
              onPress={sendMagicLink}
              accessibilityLabel={t('Skicka inloggningslänk', 'Send sign-in link')}
              hint={t('Skickar en säker engångslänk till den angivna godkända e-postadressen.', 'Sends a secure one-time link to the approved email address.')}
            >
              <Text style={styles.buttonText}>
                {submitting ? t('Skickar...', 'Sending...') : cooldown > 0 ? `${t('Skicka igen om', 'Send again in')} ${cooldown} s` : t('Skicka inloggningslänk', 'Send sign-in link')}
              </Text>
            </HintedTouchable>
          </View>
        )}

        {showMagicLink && showPassword && (
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('eller', 'or')}</Text>
            <View style={styles.dividerLine} />
          </View>
        )}

        {showPassword && (
          <View style={styles.section}>
            <Text style={styles.subtitle}>
              {showMagicLink
                ? t('Kommer länken inte fram går det att logga in med åtkomstlösenordet.', 'If the link does not arrive, you can sign in with the access password.')
                : t('Ange åtkomstlösenordet för att öppna din privata screener.', 'Enter the access password to open your private screener.')}
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
              placeholder={t('Åtkomstlösenord', 'Access password')}
              placeholderTextColor={palette.textSecondary}
              accessibilityLabel={t('Åtkomstlösenord', 'Access password')}
              accessibilityHint={t('Ange lösenordet som administratören har valt för den privata screenern.', 'Enter the password selected by the administrator for the private screener.')}
            />
            <HintedTouchable
              style={[styles.button, submitting && styles.buttonDisabled]}
              disabled={submitting}
              onPress={submitPassword}
              accessibilityLabel={t('Logga in', 'Sign in')}
              hint={t('Kontrollerar åtkomstlösenordet och öppnar screenern.', 'Checks the access password and opens the screener.')}
            >
              <Text style={styles.buttonText}>{submitting ? t('Kontrollerar...', 'Checking...') : t('Logga in', 'Sign in')}</Text>
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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  title: { color: palette.textPrimary, fontSize: 24, fontWeight: '700', flexShrink: 1 },
  languageButton: { borderWidth: 1, borderColor: palette.borderStrong, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 6 },
  languageButtonText: { color: palette.textSecondary, fontSize: 11, fontWeight: '700' },
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
