import { supabase } from '@/lib/supabase';
import { normalizeFavoriteTickers } from '@/lib/favorite-tickers';

export { normalizeFavoriteTickers } from '@/lib/favorite-tickers';

export async function loadCloudFavorites() {
  if (!supabase) return null;
  const { data, error } = await supabase.from('user_favorites').select('ticker').order('created_at', { ascending: true });
  if (error) throw error;
  return normalizeFavoriteTickers(data.map((row) => row.ticker));
}

export async function saveCloudFavorites(tickers: string[]) {
  if (!supabase) return;
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error('Ingen användarsession hittades.');

  const normalized = normalizeFavoriteTickers(tickers);
  const { error: deleteError } = await supabase.from('user_favorites').delete().eq('user_id', userId);
  if (deleteError) throw deleteError;
  if (normalized.length === 0) return;

  const { error: insertError } = await supabase.from('user_favorites').insert(
    normalized.map((ticker) => ({ user_id: userId, ticker })),
  );
  if (insertError) throw insertError;
}
