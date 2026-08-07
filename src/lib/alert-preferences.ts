import { supabase } from '@/lib/supabase';

export interface AlertPreferences {
  email_alerts_enabled: boolean;
  alert_frequency: 'DAILY_DIGEST' | 'INSTANT';
}

export async function loadAlertPreferences(): Promise<AlertPreferences | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('alert_preferences')
    .select('email_alerts_enabled, alert_frequency')
    .maybeSingle();
  if (error) throw error;
  return data as AlertPreferences | null;
}

export async function saveAlertPreferences(preferences: AlertPreferences) {
  if (!supabase) throw new Error('Inloggning med e-post krävs för e-postvarningar.');
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Ingen användarsession hittades.');
  const { error } = await supabase.from('alert_preferences').upsert({
    user_id: userId,
    ...preferences,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
