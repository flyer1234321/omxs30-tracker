import { getSupabaseAccessToken } from '@/lib/supabase';

export async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  const accessToken = await getSupabaseAccessToken();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(input, { ...init, headers, credentials: 'same-origin' });
}

export async function signOut() {
  await authenticatedFetch('/api/auth', { method: 'DELETE' });
}
