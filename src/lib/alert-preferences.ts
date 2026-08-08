import { authenticatedFetch } from '@/lib/auth-client';

export interface AlertPreferences {
  email_alerts_enabled: boolean;
  instant_alerts_enabled: boolean;
}

export async function loadAlertPreferences(): Promise<AlertPreferences | null> {
  const response = await authenticatedFetch('/api/alert-preferences');
  const payload = await response.json() as { preferences?: AlertPreferences; error?: string };
  if (!response.ok) throw new Error(payload.error || 'Kunde inte läsa varningsinställningarna.');
  return payload.preferences ?? null;
}

export async function saveAlertPreferences(preferences: AlertPreferences) {
  const response = await authenticatedFetch('/api/alert-preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preferences),
  });
  const payload = await response.json() as { error?: string };
  if (!response.ok) throw new Error(payload.error || 'Kunde inte spara varningsinställningen.');
}
