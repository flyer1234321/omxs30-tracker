import { supabase } from '@/lib/supabase';
import { isValidHolding, type Holding } from '@/lib/holdings';

/**
 * Innehav i molnet, med samma mönster som favoriterna: en rad per bolag och
 * användare, skyddad av radnivåsäkerhet så att ingen ser någon annans.
 *
 * Antal aktier och anskaffningsvärde är känsligare än en bevakningslista. Den
 * som loggar in med serverlösenordet har ingen Supabase-session, och då sparas
 * innehaven bara lokalt i stället för att felaktigt hamna hos någon annan.
 */

interface HoldingRow {
  ticker: string;
  shares: number | string;
  average_price: number | string;
  updated_at: string | null;
}

export async function loadCloudHoldings(): Promise<Holding[] | null> {
  if (!supabase) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return null;

  const { data, error } = await supabase
    .from('user_holdings')
    .select('ticker, shares, average_price, updated_at')
    .order('ticker', { ascending: true });
  if (error) throw error;

  return (data as HoldingRow[])
    .map((row) => ({
      ticker: row.ticker,
      // Postgres numeric kommer tillbaka som strang i JSON.
      shares: Number(row.shares),
      averagePrice: Number(row.average_price),
      updatedAt: row.updated_at,
    }))
    .filter(isValidHolding);
}

export async function saveCloudHolding(holding: Holding): Promise<boolean> {
  if (!supabase || !isValidHolding(holding)) return false;
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return false;

  const { error } = await supabase.from('user_holdings').upsert({
    user_id: userId,
    ticker: holding.ticker,
    shares: holding.shares,
    average_price: holding.averagePrice,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,ticker' });
  if (error) throw error;
  return true;
}

export async function removeCloudHolding(ticker: string): Promise<boolean> {
  if (!supabase) return false;
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return false;

  const { error } = await supabase.from('user_holdings').delete().eq('user_id', userId).eq('ticker', ticker);
  if (error) throw error;
  return true;
}
