import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  RefreshControl, 
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface ChartDataPoint {
  date: string;
  close: number;
  sma125?: number;
}

interface Signal {
  signal: 'KÖP' | 'SÄLJ' | 'NEUTRAL';
  reasons: string[];
}

interface StockData {
  ticker: string;
  companyName: string;
  currentPrice: number;
  sma125: number | null;
  sma200: number | null;
  rsi: number | null;
  diffPercent125: number | null;
  chartHistory: ChartDataPoint[];
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  trailingPE: number | null;
  dividendYield: number | null;
  marketCap: number | null;
  regularMarketChangePercent: number | null;
  latestVolume: number | null;
  avgVolume20: number | null;
  signalInfo: Signal | null;
}

interface SearchResult {
  symbol: string;
  shortname: string;
  exchange: string;
}

export default function HomeScreen() {
  const [data, setData] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [market, setMarket] = useState<'omxs30' | 'dji' | 'watchlist'>('omxs30');
  const [filter, setFilter] = useState<'ALL' | 'SMA125' | 'SMA200' | 'RSI' | 'KÖP'>('ALL');
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeout = useRef<any>(null);

  useEffect(() => {
    const loadWatchlist = async () => {
      try {
        const stored = await AsyncStorage.getItem('@watchlist');
        if (stored) setWatchlist(JSON.parse(stored));
      } catch (e) { console.error('Failed to load watchlist', e); }
    };
    loadWatchlist();
  }, []);

  const saveWatchlist = async (newList: string[]) => {
    try {
      await AsyncStorage.setItem('@watchlist', JSON.stringify(newList));
      setWatchlist(newList);
    } catch (e) { console.error('Failed to save watchlist', e); }
  };

  // Autocomplete search
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(text)}`);
        const json = await res.json();
        setSearchResults(json.data || []);
      } catch (e) {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const addFromSearch = (symbol: string) => {
    if (!watchlist.includes(symbol)) {
      saveWatchlist([...watchlist, symbol]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeTicker = (ticker: string) => {
    saveWatchlist(watchlist.filter(t => t !== ticker));
  };

  const fetchData = async (currentMarket = market, currentWatchlist = watchlist) => {
    setLoading(true);
    try {
      let url = `/api/analyze`;
      if (currentMarket === 'watchlist') {
        if (currentWatchlist.length === 0) {
          setData([]);
          setLoading(false);
          return;
        }
        url += `?tickers=${currentWatchlist.join(',')}`;
      } else {
        url += `?market=${currentMarket}`;
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error('Network response was not ok');
      const json = await response.json();
      if (json.error) throw new Error(json.error);
      setData(json.data || []);
      setLastUpdated(json.timestamp);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData(market, watchlist);
    const interval = setInterval(() => fetchData(market, watchlist), 60000);
    return () => clearInterval(interval);
  }, [market, watchlist]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(market, watchlist);
  }, [market, watchlist]);

  const getFilteredData = () => {
    let filtered = data;
    if (filter === 'SMA125') {
      filtered = data.filter(item => item.sma125 && item.currentPrice < item.sma125);
    } else if (filter === 'SMA200') {
      filtered = data.filter(item => item.sma200 && item.currentPrice < item.sma200);
    } else if (filter === 'RSI') {
      filtered = data.filter(item => item.rsi && item.rsi < 30);
    } else if (filter === 'KÖP') {
      filtered = data.filter(item => item.signalInfo?.signal === 'KÖP');
    }
    
    if (filter === 'RSI') {
      return [...filtered].sort((a, b) => (a.rsi || 100) - (b.rsi || 100));
    } else if (filter === 'KÖP') {
      return [...filtered].sort((a, b) => (a.signalInfo?.reasons?.length || 0) - (b.signalInfo?.reasons?.length || 0)).reverse();
    } else {
      return [...filtered].sort((a, b) => (a.diffPercent125 || 0) - (b.diffPercent125 || 0));
    }
  };

  const formatMarketCap = (cap: number | null) => {
    if (!cap) return '-';
    if (cap >= 1e12) return `${(cap / 1e12).toFixed(1)}T`;
    if (cap >= 1e9) return `${(cap / 1e9).toFixed(1)}B`;
    if (cap >= 1e6) return `${(cap / 1e6).toFixed(0)}M`;
    return cap.toLocaleString();
  };

  const formatVolume = (vol: number | null) => {
    if (!vol) return '-';
    if (vol >= 1e6) return `${(vol / 1e6).toFixed(1)}M`;
    if (vol >= 1e3) return `${(vol / 1e3).toFixed(0)}K`;
    return vol.toLocaleString();
  };

  const getSignalColor = (signal: string | undefined) => {
    if (signal === 'KÖP') return '#34C759';
    if (signal === 'SÄLJ') return '#FF3B30';
    return '#FF9500';
  };

  const getSignalBg = (signal: string | undefined) => {
    if (signal === 'KÖP') return 'rgba(52, 199, 89, 0.15)';
    if (signal === 'SÄLJ') return 'rgba(255, 59, 48, 0.15)';
    return 'rgba(255, 149, 0, 0.15)';
  };

  const renderTabs = () => (
    <View style={styles.tabsContainer}>
      {(['omxs30', 'dji', 'watchlist'] as const).map(tab => (
        <TouchableOpacity 
          key={tab} 
          style={[styles.tab, market === tab && styles.activeTab]}
          onPress={() => setMarket(tab)}
        >
          <Text style={[styles.tabText, market === tab && styles.activeTabText]}>
            {tab === 'omxs30' ? '🇸🇪 Sverige' : tab === 'dji' ? '🇺🇸 USA' : '⭐ Min Lista'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderFilters = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filtersContainer}>
      {(['ALL', 'KÖP', 'SMA125', 'SMA200', 'RSI'] as const).map(f => (
        <TouchableOpacity 
          key={f} 
          style={[styles.filterChip, filter === f && styles.activeFilterChip]}
          onPress={() => setFilter(f)}
        >
          <Text style={[styles.filterText, filter === f && styles.activeFilterText]}>
            {f === 'ALL' ? 'Alla' : f === 'KÖP' ? '🟢 Köpsignal' : f === 'SMA125' ? '< SMA 125' : f === 'SMA200' ? '< SMA 200' : 'RSI < 30'}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderSearchInput = () => {
    if (market !== 'watchlist') return null;
    return (
      <View style={styles.searchContainer}>
        <View style={styles.searchInputRow}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Sök aktie (t.ex. Volvo, Tesla, Apple...)"
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={handleSearchChange}
          />
          {isSearching && <ActivityIndicator size="small" color="#007AFF" />}
        </View>
        {searchResults.length > 0 && (
          <View style={styles.searchDropdown}>
            {searchResults.map((result, i) => (
              <TouchableOpacity 
                key={`${result.symbol}-${i}`}
                style={styles.searchResultItem}
                onPress={() => addFromSearch(result.symbol)}
              >
                <View>
                  <Text style={styles.searchResultSymbol}>{result.symbol}</Text>
                  <Text style={styles.searchResultName}>{result.shortname}</Text>
                </View>
                <View style={styles.searchResultExchange}>
                  <Text style={styles.searchResultExchangeText}>{result.exchange}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {watchlist.length > 0 && (
          <View style={styles.watchlistChips}>
            {watchlist.map(ticker => (
              <TouchableOpacity key={ticker} style={styles.watchlistChip} onPress={() => removeTicker(ticker)}>
                <Text style={styles.watchlistChipText}>{ticker}</Text>
                <Text style={styles.watchlistChipX}> ✕</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => {
    if (loading) return null;
    if (market === 'watchlist' && watchlist.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>👀</Text>
          <Text style={styles.emptyText}>Din bevakningslista är tom.{'\n'}Sök efter aktier ovan!</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>⚠️ {error}</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>🚀</Text>
        <Text style={styles.emptyText}>Inga aktier matchar ditt filter just nu!</Text>
      </View>
    );
  };

  const renderChart = (item: StockData) => {
    if (!item.chartHistory || item.chartHistory.length === 0) return null;

    const priceData = item.chartHistory.map(d => ({ value: d.close }));
    const smaData = item.chartHistory
      .filter(d => d.sma125 != null)
      .map(d => ({ value: d.sma125! }));

    const chartWidth = SCREEN_WIDTH - 80;

    return (
      <View style={styles.chartSection}>
        <View style={styles.chartLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#007AFF' }]} />
            <Text style={styles.legendText}>Kurs</Text>
          </View>
          {smaData.length > 0 && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FF9500' }]} />
              <Text style={styles.legendText}>SMA 125</Text>
            </View>
          )}
        </View>
        <LineChart
          data={priceData}
          data2={smaData.length > 0 ? smaData : undefined}
          width={chartWidth}
          height={140}
          color="#007AFF"
          color2="#FF9500"
          thickness={2}
          thickness2={1.5}
          hideDataPoints
          hideDataPoints2
          hideRules
          hideYAxisText
          yAxisColor="transparent"
          xAxisColor="#333"
          curved
          areaChart
          startFillColor="rgba(0, 122, 255, 0.15)"
          endFillColor="rgba(0, 122, 255, 0.02)"
          startOpacity={0.3}
          endOpacity={0}
        />
      </View>
    );
  };

  const renderAnalysis = (item: StockData) => {
    if (!item.signalInfo) return null;
    const signalColor = getSignalColor(item.signalInfo.signal);
    const signalBg = getSignalBg(item.signalInfo.signal);

    return (
      <View style={styles.analysisSection}>
        <View style={[styles.signalBadgeLarge, { backgroundColor: signalBg, borderColor: signalColor }]}>
          <Text style={[styles.signalText, { color: signalColor }]}>
            {item.signalInfo.signal === 'KÖP' ? '🟢' : item.signalInfo.signal === 'SÄLJ' ? '🔴' : '🟡'} {item.signalInfo.signal}
          </Text>
        </View>
        {item.signalInfo.reasons.map((reason, i) => (
          <View key={i} style={styles.reasonRow}>
            <Text style={styles.reasonBullet}>•</Text>
            <Text style={styles.reasonText}>{reason}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderFundamentals = (item: StockData) => (
    <View style={styles.fundamentalsGrid}>
      <View style={styles.fundRow}>
        <View style={styles.fundItem}>
          <Text style={styles.fundLabel}>52v Hög</Text>
          <Text style={styles.fundValue}>{item.fiftyTwoWeekHigh?.toFixed(2) || '-'}</Text>
        </View>
        <View style={styles.fundItem}>
          <Text style={styles.fundLabel}>52v Låg</Text>
          <Text style={styles.fundValue}>{item.fiftyTwoWeekLow?.toFixed(2) || '-'}</Text>
        </View>
        <View style={styles.fundItem}>
          <Text style={styles.fundLabel}>P/E</Text>
          <Text style={styles.fundValue}>{item.trailingPE?.toFixed(1) || '-'}</Text>
        </View>
      </View>
      <View style={styles.fundRow}>
        <View style={styles.fundItem}>
          <Text style={styles.fundLabel}>Utdelning</Text>
          <Text style={styles.fundValue}>{item.dividendYield ? `${(item.dividendYield * 100).toFixed(1)}%` : '-'}</Text>
        </View>
        <View style={styles.fundItem}>
          <Text style={styles.fundLabel}>Volym</Text>
          <Text style={styles.fundValue}>{formatVolume(item.latestVolume)}</Text>
        </View>
        <View style={styles.fundItem}>
          <Text style={styles.fundLabel}>Börsvärde</Text>
          <Text style={styles.fundValue}>{formatMarketCap(item.marketCap)}</Text>
        </View>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: StockData }) => {
    const isExpanded = expandedTicker === item.ticker;
    const signalColor = getSignalColor(item.signalInfo?.signal);
    const dayChange = item.regularMarketChangePercent;
    const dayColor = dayChange && dayChange >= 0 ? '#34C759' : '#FF3B30';

    return (
      <TouchableOpacity 
        style={styles.card} 
        activeOpacity={0.85}
        onPress={() => setExpandedTicker(isExpanded ? null : item.ticker)}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.tickerRow}>
              <Text style={styles.ticker}>{item.ticker.replace('.ST', '')}</Text>
              {item.signalInfo && (
                <View style={[styles.signalDot, { backgroundColor: signalColor }]}>
                  <Text style={styles.signalDotText}>{item.signalInfo.signal}</Text>
                </View>
              )}
            </View>
            <Text style={styles.companyName} numberOfLines={1}>{item.companyName}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.priceMain}>{item.currentPrice?.toFixed(2)}</Text>
            {dayChange != null && (
              <Text style={[styles.dayChange, { color: dayColor }]}>
                {dayChange >= 0 ? '▲' : '▼'} {Math.abs(dayChange).toFixed(2)}%
              </Text>
            )}
          </View>
        </View>
        
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>SMA 125</Text>
            <Text style={[styles.statValue, item.sma125 && item.currentPrice < item.sma125 ? { color: '#FF3B30' } : { color: '#34C759' }]}>
              {item.diffPercent125?.toFixed(2) || '-'}%
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>RSI</Text>
            <Text style={[styles.statValue, item.rsi && item.rsi < 30 ? { color: '#FF3B30' } : item.rsi && item.rsi > 70 ? { color: '#34C759' } : { color: '#FFFFFF' }]}>
              {item.rsi?.toFixed(1) || '-'}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>P/E</Text>
            <Text style={styles.statValue}>{item.trailingPE?.toFixed(1) || '-'}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Utdeln.</Text>
            <Text style={styles.statValue}>{item.dividendYield ? `${(item.dividendYield * 100).toFixed(1)}%` : '-'}</Text>
          </View>
        </View>

        {isExpanded && (
          <View style={styles.expandedContent}>
            {renderChart(item)}
            {renderFundamentals(item)}
            {renderAnalysis(item)}
            {market === 'watchlist' && (
              <TouchableOpacity style={styles.removeButton} onPress={() => removeTicker(item.ticker)}>
                <Text style={styles.removeButtonText}>Ta bort från listan</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.expandHint}>
          <Text style={styles.expandHintText}>{isExpanded ? '▲ Stäng' : '▼ Visa analys & graf'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const filteredData = getFilteredData();
  const buyCount = data.filter(d => d.signalInfo?.signal === 'KÖP').length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>📊 Screener</Text>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{filteredData.length} / {data.length}</Text>
          </View>
        </View>
        <Text style={styles.headerSubtitle}>
          {lastUpdated ? `Uppdaterad ${new Date(lastUpdated).toLocaleTimeString('sv-SE', {hour: '2-digit', minute:'2-digit'})}` : 'Hämtar...'} 
          {buyCount > 0 ? ` · ${buyCount} köpsignal${buyCount > 1 ? 'er' : ''}` : ''}
        </Text>
      </View>
      
      {renderTabs()}
      {renderSearchInput()}
      {renderFilters()}

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Analyserar marknaden...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item) => item.ticker}
          renderItem={renderItem}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#fff"
              colors={['#007AFF']}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#FFFFFF' },
  headerBadge: { backgroundColor: '#1C1C1E', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  headerBadgeText: { color: '#8E8E93', fontSize: 13, fontWeight: '600' },
  headerSubtitle: { fontSize: 13, color: '#8E8E93', marginTop: 4 },

  tabsContainer: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#222' },
  activeTab: { borderBottomColor: '#007AFF' },
  tabText: { color: '#8E8E93', fontWeight: '600', fontSize: 14 },
  activeTabText: { color: '#007AFF' },

  searchContainer: { paddingHorizontal: 16, marginBottom: 12, zIndex: 100 },
  searchInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C1E', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  searchIcon: { fontSize: 16, marginRight: 10 },
  searchInput: { flex: 1, color: '#FFF', fontSize: 15 },
  searchDropdown: { backgroundColor: '#2C2C2E', borderRadius: 12, marginTop: 8, overflow: 'hidden' },
  searchResultItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#3A3A3C' },
  searchResultSymbol: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  searchResultName: { color: '#8E8E93', fontSize: 13, marginTop: 2 },
  searchResultExchange: { backgroundColor: '#3A3A3C', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  searchResultExchangeText: { color: '#8E8E93', fontSize: 11 },
  watchlistChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  watchlistChip: { flexDirection: 'row', backgroundColor: '#2C2C2E', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, alignItems: 'center' },
  watchlistChipText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  watchlistChipX: { color: '#FF3B30', fontSize: 12, fontWeight: '700' },

  filtersScroll: { marginBottom: 12 },
  filtersContainer: { paddingHorizontal: 16, gap: 8 },
  filterChip: { backgroundColor: '#1C1C1E', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#333' },
  activeFilterChip: { backgroundColor: 'rgba(0, 122, 255, 0.15)', borderColor: '#007AFF' },
  filterText: { color: '#8E8E93', fontSize: 13, fontWeight: '600' },
  activeFilterText: { color: '#007AFF' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8E8E93', marginTop: 12, fontSize: 16 },
  listContent: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30, paddingTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: '#8E8E93', fontSize: 17, textAlign: 'center', lineHeight: 26 },

  card: { backgroundColor: '#1C1C1E', borderRadius: 16, padding: 16, marginBottom: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  tickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ticker: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  companyName: { color: '#8E8E93', fontSize: 13, marginTop: 2, maxWidth: 200 },
  priceMain: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  dayChange: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  signalDot: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  signalDotText: { color: '#FFF', fontSize: 11, fontWeight: '800' },

  statsRow: { flexDirection: 'row', backgroundColor: '#2C2C2E', borderRadius: 12, padding: 12, marginBottom: 4 },
  statItem: { flex: 1, alignItems: 'center' },
  statLabel: { color: '#8E8E93', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 },
  statValue: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  statDivider: { width: 1, backgroundColor: '#3A3A3C', marginHorizontal: 4 },

  expandedContent: { marginTop: 16 },
  
  chartSection: { marginBottom: 16 },
  chartLegend: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: '#8E8E93', fontSize: 12 },

  fundamentalsGrid: { backgroundColor: '#2C2C2E', borderRadius: 12, padding: 12, marginBottom: 16 },
  fundRow: { flexDirection: 'row', marginBottom: 8 },
  fundItem: { flex: 1 },
  fundLabel: { color: '#8E8E93', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3 },
  fundValue: { color: '#FFF', fontSize: 14, fontWeight: '600' },

  analysisSection: { backgroundColor: '#1A1A2E', borderRadius: 12, padding: 14, marginBottom: 16 },
  signalBadgeLarge: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1, marginBottom: 10 },
  signalText: { fontWeight: '800', fontSize: 15 },
  reasonRow: { flexDirection: 'row', marginBottom: 4, paddingRight: 10 },
  reasonBullet: { color: '#8E8E93', marginRight: 8, fontSize: 14 },
  reasonText: { color: '#C7C7CC', fontSize: 13, flex: 1, lineHeight: 18 },

  removeButton: { alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(255, 59, 48, 0.1)', borderWidth: 1, borderColor: 'rgba(255, 59, 48, 0.3)' },
  removeButtonText: { color: '#FF3B30', fontWeight: '600', fontSize: 14 },

  expandHint: { alignItems: 'center', paddingTop: 8 },
  expandHintText: { color: '#555', fontSize: 12, fontWeight: '500' },
});
