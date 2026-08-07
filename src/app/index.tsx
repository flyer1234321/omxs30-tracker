import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Text,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FilterBar } from '../components/FilterBar';
import ProTableView from '../components/ProTableView';
import type { StockData } from '../components/ProTableView';
import { StockDetailModal } from '../components/StockDetailModal';
import ProFilterPanel, { applyProFilter, type ProFilter } from '../components/ProFilterPanel';
import { WorkspaceBar } from '../components/WorkspaceBar';
import {
  ACTIVE_WORKSPACE_STORAGE_KEY,
  DEFAULT_WORKSPACES,
  normalizeWorkspace,
  WORKSPACE_STORAGE_KEY,
} from '../lib/workspaces';
import type { MarketId, TableColumnId, Workspace } from '../types/stock';
import { colors, maxContentWidth } from '../theme';
import { authenticatedFetch } from '../lib/auth-client';
import { useAppAuth } from '../components/AuthGate';
import { loadCloudFavorites, saveCloudFavorites } from '../lib/cloud-favorites';
import { normalizeFavoriteTickers } from '../lib/favorite-tickers';
import { isSupabaseConfigured } from '../lib/supabase';
import { AlertSettings } from '../components/AlertSettings';
import { isJustAfterClose, isMarketOpen, regionForMarket } from '../lib/market-hours';

interface SearchResult { symbol: string; shortname: string; exchange: string; }

/**
 * Servern cachar marknadsdata i fem minuter när börsen är öppen, så tätare
 * polling än så ger bara identiska svar. Tidigare hämtades allt var 60:e
 * sekund dygnet runt, vilket blev omkring 1 400 anrop per dag och öppen flik
 * helt utan nytt innehåll.
 */
const POLL_INTERVAL_MS = 5 * 60 * 1000;

export default function HomeScreen() {
  const { signOut } = useAppAuth();
  // ─── STATE ─────────────────────────────────
  const [data, setData] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [market, setMarket] = useState<MarketId>('omxs30');
  const [filter, setFilter] = useState<string>('all');
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [proFilter, setProFilter] = useState<ProFilter>({});
  const [proFilterExpanded, setProFilterExpanded] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>(DEFAULT_WORKSPACES);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(DEFAULT_WORKSPACES[0].id);
  const [alertSettingsOpen, setAlertSettingsOpen] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── WATCHLIST PERSISTENCE ─────────────────
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('@watchlist');
        const localWatchlist = stored ? normalizeFavoriteTickers(JSON.parse(stored)) : [];
        if (!isSupabaseConfigured) {
          setWatchlist(localWatchlist);
          return;
        }
        try {
          const cloudWatchlist = await loadCloudFavorites();
          setWatchlist(cloudWatchlist ?? localWatchlist);
        } catch {
          setWatchlist(localWatchlist);
          setError('Favoriter kunde inte synkas. Den lokala listan används tills anslutningen fungerar igen.');
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [storedWorkspaces, storedActiveWorkspace] = await Promise.all([
          AsyncStorage.getItem(WORKSPACE_STORAGE_KEY),
          AsyncStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY),
        ]);
        if (storedWorkspaces) {
          const parsed: unknown = JSON.parse(storedWorkspaces);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const restored = parsed.map((workspace) => normalizeWorkspace(workspace as Workspace));
            setWorkspaces(restored);
            if (storedActiveWorkspace && restored.some((workspace) => workspace.id === storedActiveWorkspace)) {
              setActiveWorkspaceId(storedActiveWorkspace);
            }
          }
        }
      } catch {}
    })();
  }, []);

  const saveWatchlist = async (list: string[]) => {
    const normalized = normalizeFavoriteTickers(list);
    setWatchlist(normalized);
    try { await AsyncStorage.setItem('@watchlist', JSON.stringify(normalized)); } catch {}
    if (isSupabaseConfigured) {
      try {
        await saveCloudFavorites(normalized);
      } catch {
        setError('Favoriten sparades lokalt men kunde inte synkas till ditt konto.');
      }
    }
  };

  const saveWorkspaces = async (nextWorkspaces: Workspace[], nextActiveWorkspaceId = activeWorkspaceId) => {
    setWorkspaces(nextWorkspaces);
    setActiveWorkspaceId(nextActiveWorkspaceId);
    try {
      await Promise.all([
        AsyncStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(nextWorkspaces)),
        AsyncStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, nextActiveWorkspaceId),
      ]);
    } catch {}
  };

  const updateWorkspaceColumns = (id: string, columns: TableColumnId[]) => {
    const updatedAt = new Date().toISOString();
    const next = workspaces.map((workspace) => workspace.id === id
      ? normalizeWorkspace({ ...workspace, columns, updatedAt })
      : workspace);
    saveWorkspaces(next, id);
  };

  const createWorkspace = (name: string, columns: TableColumnId[]) => {
    const timestamp = new Date().toISOString();
    const workspace = normalizeWorkspace({
      id: `custom-${Date.now()}`,
      name,
      columns,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    saveWorkspaces([...workspaces, workspace], workspace.id);
  };

  const deleteWorkspace = (id: string) => {
    const next = workspaces.filter((workspace) => workspace.id !== id);
    const nextActiveWorkspaceId = next.some((workspace) => workspace.id === activeWorkspaceId)
      ? activeWorkspaceId
      : next[0]?.id ?? DEFAULT_WORKSPACES[0].id;
    saveWorkspaces(next.length > 0 ? next : DEFAULT_WORKSPACES, nextActiveWorkspaceId);
  };

  // ─── SEARCH ────────────────────────────────
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!text.trim()) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await authenticatedFetch(`/api/search?q=${encodeURIComponent(text)}`);
        const json = await res.json();
        setSearchResults(json.data || []);
      } catch { setSearchResults([]); }
      finally { setIsSearching(false); }
    }, 300);
  };

  const addFromSearch = (symbol: string) => {
    if (!watchlist.includes(symbol)) saveWatchlist([...watchlist, symbol]);
    setSearchQuery(''); setSearchResults([]);
  };

  // ─── DATA FETCHING ─────────────────────────
  const fetchData = useCallback(async (m: MarketId, wl: string[]) => {
    setLoading(true);
    try {
      let url = `/api/analyze?t=${Date.now()}`;
      if (m === 'watchlist') {
        if (wl.length === 0) { setData([]); setError(null); return; }
        url += `&tickers=${wl.join(',')}`;
      } else { url += `&market=${m}`; }
      const response = await authenticatedFetch(url);
      if (!response.ok) throw new Error('Nätverksfel');
      const json = await response.json();
      if (json.error) throw new Error(json.error);
      setData(json.data || []); setLastUpdated(json.timestamp); setError(null);
    } catch (err: any) { setError(err.message); }
    // Både loading och refreshing nollställs här. Tidigare låg de i grenarna
    // ovan, så en tom favoritlista lämnade pull-to-refresh snurrande.
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  const onMarketChange = (tab: MarketId) => {
    if (tab !== market) {
      setData([]);
      setMarket(tab);
      setSelectedTicker(null);
    }
  };

  // Favoritlistan läses via en ref i pollningen, så att ett tillagt bolag inte
  // startar om intervallet eller triggar en omhämtning av en marknad som inte
  // ens visar favoriter.
  const watchlistRef = useRef(watchlist);
  useEffect(() => { watchlistRef.current = watchlist; }, [watchlist]);
  const watchlistKey = market === 'watchlist' ? watchlist.join(',') : '';

  useEffect(() => {
    fetchData(market, watchlistRef.current);
  }, [market, watchlistKey, fetchData]);

  const marketRegion = regionForMarket(market);
  const marketOpen = isMarketOpen(marketRegion);

  useEffect(() => {
    const interval = setInterval(() => {
      // Stängd börs ger inga nya avslut. Undantaget är strax efter stängning,
      // då slutkursen fortfarande kan justeras.
      if (!isMarketOpen(marketRegion) && !isJustAfterClose(marketRegion)) return;
      fetchData(market, watchlistRef.current);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [market, marketRegion, fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(market, watchlistRef.current);
  }, [market, fetchData]);

  // ─── FILTERING (useMemo for performance) ───
  const quickFilteredData = useMemo(() => {
    let f = data;

    // Basic quick-filter
    if (filter === 'gradeA') f = f.filter(d => d.healthCheck?.grade === 'A');
    else if (filter === 'gradeAB') f = f.filter(d => d.healthCheck && ['A','B'].includes(d.healthCheck.grade));
    else if (filter === 'underSMA') f = f.filter(d => d.sma125 && d.currentPrice < d.sma125);
    else if (filter === 'oversold') f = f.filter(d => d.rsi != null && d.rsi < 30);

    return f;
  }, [data, filter]);
  const filteredData = useMemo(() => applyProFilter(quickFilteredData, proFilter), [quickFilteredData, proFilter]);

  const gradeACount = useMemo(() => data.filter(d => d.healthCheck?.grade === 'A').length, [data]);
  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0],
    [activeWorkspaceId, workspaces],
  );

  // ─── MODAL ─────────────────────────────────
  const selectedItem = useMemo(() => data.find(d => d.ticker === selectedTicker) || null, [data, selectedTicker]);
  const isWatchlisted = selectedTicker ? watchlist.includes(selectedTicker) : false;

  const toggleWatchlist = () => {
    if (!selectedTicker) return;
    if (isWatchlisted) {
      saveWatchlist(watchlist.filter(t => t !== selectedTicker));
    } else {
      saveWatchlist([...watchlist, selectedTicker]);
    }
  };

  // ─── RENDER ────────────────────────────────
  return (
    <View style={s.container}>
      {/* Tabellen sträckte sig tidigare över hela skärmbredden, vilket gav
          orimligt breda kolumner på en dator. */}
      <View style={s.content}>
      <FilterBar
        market={market}
        onMarketChange={onMarketChange}
        filter={filter}
        onFilterChange={setFilter}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        searchResults={searchResults}
        isSearching={isSearching}
        onAddFromSearch={addFromSearch}
        watchlist={watchlist}
        onRemoveFromWatchlist={(t) => saveWatchlist(watchlist.filter(x => x !== t))}
        totalCount={data.length}
        filteredCount={filteredData.length}
        lastUpdated={lastUpdated}
        gradeACount={gradeACount}
        marketOpen={marketOpen}
        onSignOut={() => { void signOut(); }}
        onOpenAlertSettings={() => setAlertSettingsOpen(true)}
      />

      <AlertSettings visible={alertSettingsOpen} onClose={() => setAlertSettingsOpen(false)} />

      <WorkspaceBar
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onSelect={(id) => saveWorkspaces(workspaces, id)}
        onUpdateColumns={updateWorkspaceColumns}
        onCreate={createWorkspace}
        onDelete={deleteWorkspace}
      />

      <ProFilterPanel
        activeFilter={proFilter}
        onFilterChange={setProFilter}
        isExpanded={proFilterExpanded}
        onToggleExpand={() => setProFilterExpanded(!proFilterExpanded)}
        onShowResults={() => setProFilterExpanded(false)}
        candidateCount={quickFilteredData.length}
        matchCount={filteredData.length}
      />

      {error && (
        <View style={s.errorWrap}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      {loading && !refreshing && data.length === 0 ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={s.loadingText}>Analyserar marknaden...</Text>
        </View>
      ) : (
        <ProTableView
          data={filteredData}
          visibleColumns={activeWorkspace?.columns ?? DEFAULT_WORKSPACES[0].columns}
          onStockPress={setSelectedTicker}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      )}

      </View>

      <StockDetailModal
        item={selectedItem}
        onClose={() => setSelectedTicker(null)}
        isWatchlisted={isWatchlisted}
        onToggleWatchlist={toggleWatchlist}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' },
  errorWrap: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#3D0A0A' },
  errorText: { color: '#FF3B30', fontSize: 13 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: colors.textSecondary, marginTop: 12, fontSize: 14 },
});
