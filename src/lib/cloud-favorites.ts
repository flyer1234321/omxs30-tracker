import { supabase } from '@/lib/supabase';
import { normalizeFavoriteTickers } from '@/lib/favorite-tickers';

export { normalizeFavoriteTickers } from '@/lib/favorite-tickers';

export async function loadCloudFavorites() {
  if (!supabase) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return null;
  const { data, error } = await supabase.from('user_favorites').select('ticker').order('created_at', { ascending: true });
  if (error) throw error;
  return normalizeFavoriteTickers(data.map((row) => row.ticker));
}

export async function saveCloudFavorites(tickers: string[]) {
  if (!supabase) return false;
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  // Lösenordsinloggning har ingen Supabase-session. Favoriterna sparas då
  // lokalt utan att ett normalt inloggningsläge visas som ett synkfel.
  if (!userId) return false;

  const normalized = normalizeFavoriteTickers(tickers);
  const { error: deleteError } = await supabase.from('user_favorites').delete().eq('user_id', userId);
  if (deleteError) throw deleteError;
  if (normalized.length === 0) return true;

  const { error: insertError } = await supabase.from('user_favorites').insert(
    normalized.map((ticker) => ({ user_id: userId, ticker })),
  );
  if (insertError) throw insertError;
  return true;
}
