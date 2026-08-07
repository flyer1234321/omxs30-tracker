export async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, { ...init, credentials: 'same-origin' });
}

export async function signOut() {
  await authenticatedFetch('/api/auth', { method: 'DELETE' });
}
