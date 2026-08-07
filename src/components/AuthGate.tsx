import React, { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { authenticatedFetch, signOut as endSession } from '@/lib/auth-client';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const AuthContext = createContext({ signOut: async () => {} });

export function useAppAuth() {
  return useContext(AuthContext);
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      authenticatedFetch('/api/auth')
        .then((response) => response.json())
        .then((data: { configured?: boolean; authenticated?: boolean }) => {
          setConfigured(Boolean(data.configured));
          setAuthenticated(Boolean(data.authenticated));
        })
        .catch(() => setConfigured(false));
      return;
    }

    const supabaseClient = supabase;
    let active = true;
    const syncSession = async (providedSession?: { access_token: string } | null) => {
      const session = providedSession === undefined
        ? (await supabaseClient.auth.getSession()).data.session
        : providedSession;
      if (!active) return;
      setConfigured(true);
      if (!session) {
        setAuthenticated(false);
        return;
      }

      try {
        const response = await fetch('/api/auth', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          credentials: 'same-origin',
        });
        const data: { authenticated?: boolean } = await response.json();
        if (!active) return;
        setAuthenticated(Boolean(data.authenticated));
        if (!data.authenticated) await supabaseClient.auth.signOut();
      } catch {
        if (active) setAuthenticated(false);
      }
    };
    void syncSession();
    const { data: listener } = supabaseClient.auth.onAuthStateChange((_event, session) => { void syncSession(session); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const submitPassword = async () => {
    if (!password || submitting) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await authenticatedFetch('/api/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
      });
      const data: { authenticated?: boolean; error?: string; retryAfterSeconds?: number } = await response.json();
      if (data.authenticated) {
        setPassword('');
        setAuthenticated(true);
      } else {
        setMessage(data.retryAfterSeconds ? `${data.error} Vänta cirka ${Math.ceil(data.retryAfterSeconds / 60)} minuter.` : data.error || 'Inloggningen misslyckades.');
      }
    } catch {
      setMessage('Kunde inte kontakta inloggningstjänsten.');
    } finally {
      setSubmitting(false);
    }
  };

  const sendMagicLink = async () => {
    if (!email.trim() || submitting) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await authenticatedFetch('/api/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await response.json() as { sent?: boolean; error?: string };
      setMessage(data.sent ? 'Kontrollera din e-post och öppna inloggningslänken.' : data.error || 'Kunde inte skicka inloggningslänken.');
    } catch {
      setMessage('Kunde inte kontakta inloggningstjänsten.');
    } finally {
      setSubmitting(false);
    }
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    await endSession();
    setAuthenticated(false);
  };

  if (configured === null) return <View style={styles.loading}><ActivityIndicator color="#60a5fa" /></View>;
  if (authenticated) return <AuthContext.Provider value={{ signOut }}>{children}</AuthContext.Provider>;

  const supabaseMode = isSupabaseConfigured;
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.card}>
        <Text style={styles.title}>OMX30 Screener</Text>
        {!configured ? <Text style={styles.message}>Inloggning är inte konfigurerad ännu. Lägg till `APP_ACCESS_PASSWORD` och `APP_SESSION_SECRET` i `.env.local`.</Text> : supabaseMode ? <>
          <Text style={styles.subtitle}>Ange din e-postadress för en säker inloggningslänk.</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" onSubmitEditing={sendMagicLink} placeholder="E-postadress" placeholderTextColor="#6b6b82" />
          <TouchableOpacity style={[styles.button, submitting && styles.buttonDisabled]} disabled={submitting} onPress={sendMagicLink}><Text style={styles.buttonText}>{submitting ? 'Skickar...' : 'Skicka inloggningslänk'}</Text></TouchableOpacity>
          {message && <Text style={styles.message}>{message}</Text>}
        </> : <>
          <Text style={styles.subtitle}>Ange åtkomstlösenordet för att öppna din privata screener.</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} onSubmitEditing={submitPassword} placeholder="Åtkomstlösenord" placeholderTextColor="#6b6b82" />
          <TouchableOpacity style={[styles.button, submitting && styles.buttonDisabled]} disabled={submitting} onPress={submitPassword}><Text style={styles.buttonText}>{submitting ? 'Kontrollerar...' : 'Logga in'}</Text></TouchableOpacity>
          {message && <Text style={styles.message}>{message}</Text>}
        </>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#08080f', justifyContent: 'center', padding: 20 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#08080f' },
  card: { width: '100%', maxWidth: 400, alignSelf: 'center', backgroundColor: '#111118', borderWidth: 1, borderColor: '#242434', borderRadius: 8, padding: 24 },
  title: { color: '#e2e2ea', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#a0a0b2', fontSize: 14, lineHeight: 20, marginBottom: 20 },
  input: { color: '#e2e2ea', backgroundColor: '#08080f', borderWidth: 1, borderColor: '#333346', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  button: { alignItems: 'center', backgroundColor: '#2563eb', borderRadius: 6, marginTop: 12, paddingVertical: 12 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  message: { color: '#a0a0b2', fontSize: 13, lineHeight: 19, marginTop: 14 },
});
