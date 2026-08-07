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
import { colors } from '../theme';

interface SearchResult { symbol: string; shortname: string; exchange: string; }

export default function HomeScreen() {
  // ─── STATE ─────────────────────────────────
  const [data, setData] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [market, setMarket] = useState<'omxs30' | 'dji' | 'tech' | 'swe_fastigheter' | 'watchlist'>('omxs30');
  const [filter, setFilter] = useState<string>('all');
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [proFilter, setProFilter] = useState<ProFilter>({});
  const [proFilterExpanded, setProFilterExpanded] = useState(false);
  const searchTimeout = useRef<any>(null);

  // ─── WATCHLIST PERSISTENCE ─────────────────
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('@watchlist');
        if (stored) setWatchlist(JSON.parse(stored));
      } catch {}
    })();
  }, []);

  const saveWatchlist = async (list: string[]) => {
    try { await AsyncStorage.setItem('@watchlist', JSON.stringify(list)); setWatchlist(list); } catch {}
  };

  // ─── SEARCH ────────────────────────────────
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!text.trim()) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(text)}`);
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
  const fetchData = useCallback(async (m = market, wl = watchlist) => {
    setLoading(true);
    try {
      let url = `/api/analyze?t=${Date.now()}`;
      if (m === 'watchlist') {
        if (wl.length === 0) { setData([]); setLoading(false); return; }
        url += `&tickers=${wl.join(',')}`;
      } else { url += `&market=${m}`; }
      const response = await fetch(url);
      if (!response.ok) throw new Error('Nätverksfel');
      const json = await response.json();
      if (json.error) throw new Error(json.error);
      setData(json.data || []); setLastUpdated(json.timestamp); setError(null);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [market, watchlist]);

  const onMarketChange = (tab: any) => {
    if (tab !== market) {
      setData([]);
      setMarket(tab);
      setSelectedTicker(null);
    }
  };

  useEffect(() => {
    fetchData(market, watchlist);
    const interval = setInterval(() => fetchData(market, watchlist), 60000);
    return () => clearInterval(interval);
  }, [market, watchlist, fetchData]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchData(market, watchlist); }, [market, watchlist, fetchData]);

  // ─── FILTERING (useMemo for performance) ───
  const filteredData = useMemo(() => {
    let f = data;

    // Basic quick-filter
    if (filter === 'gradeA') f = f.filter(d => d.healthCheck?.grade === 'A');
    else if (filter === 'gradeAB') f = f.filter(d => d.healthCheck && ['A','B'].includes(d.healthCheck.grade));
    else if (filter === 'underSMA') f = f.filter(d => d.sma125 && d.currentPrice < d.sma125);
    else if (filter === 'oversold') f = f.filter(d => d.rsi != null && d.rsi < 30);

    // Pro filter (AND logic)
    f = applyProFilter(f, proFilter);

    return f;
  }, [data, filter, proFilter]);

  const gradeACount = useMemo(() => data.filter(d => d.healthCheck?.grade === 'A').length, [data]);

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
      />

      <ProFilterPanel
        activeFilter={proFilter}
        onFilterChange={setProFilter}
        isExpanded={proFilterExpanded}
        onToggleExpand={() => setProFilterExpanded(!proFilterExpanded)}
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
          onStockPress={setSelectedTicker}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      )}

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
  errorWrap: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#3D0A0A' },
  errorText: { color: '#FF3B30', fontSize: 13 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: colors.textSecondary, marginTop: 12, fontSize: 14 },
});
