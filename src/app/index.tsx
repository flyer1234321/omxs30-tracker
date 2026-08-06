import React, { useState, useEffect, useCallback } from 'react';
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
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ChartDataPoint {
  date: string;
  close: number;
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
}

export default function HomeScreen() {
  const [data, setData] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [market, setMarket] = useState<'omxs30' | 'dji' | 'watchlist'>('omxs30');
  const [filter, setFilter] = useState<'SMA125' | 'SMA200' | 'RSI'>('SMA125');
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [newTicker, setNewTicker] = useState('');

  // Ladda bevakningslista vid start
  useEffect(() => {
    const loadWatchlist = async () => {
      try {
        const stored = await AsyncStorage.getItem('@watchlist');
        if (stored) {
          setWatchlist(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Failed to load watchlist', e);
      }
    };
    loadWatchlist();
  }, []);

  const saveWatchlist = async (newList: string[]) => {
    try {
      await AsyncStorage.setItem('@watchlist', JSON.stringify(newList));
      setWatchlist(newList);
    } catch (e) {
      console.error('Failed to save watchlist', e);
    }
  };

  const addTicker = () => {
    if (!newTicker.trim()) return;
    const ticker = newTicker.trim().toUpperCase();
    if (!watchlist.includes(ticker)) {
      saveWatchlist([...watchlist, ticker]);
    }
    setNewTicker('');
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
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const json = await response.json();
      if (json.error) {
        throw new Error(json.error);
      }
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
    const interval = setInterval(() => {
      fetchData(market, watchlist);
    }, 60000);
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
    }
    
    // Sort by most negative deviation or lowest RSI
    if (filter === 'RSI') {
      return filtered.sort((a, b) => (a.rsi || 100) - (b.rsi || 100));
    } else if (filter === 'SMA200') {
      return filtered.sort((a, b) => {
         const diffA = (a.currentPrice - (a.sma200||0)) / (a.sma200||1);
         const diffB = (b.currentPrice - (b.sma200||0)) / (b.sma200||1);
         return diffA - diffB;
      });
    } else {
      return filtered.sort((a, b) => (a.diffPercent125 || 0) - (b.diffPercent125 || 0));
    }
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
            {tab === 'omxs30' ? 'Sverige' : tab === 'dji' ? 'USA' : 'Min Lista'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      {(['SMA125', 'SMA200', 'RSI'] as const).map(f => (
        <TouchableOpacity 
          key={f} 
          style={[styles.filterChip, filter === f && styles.activeFilterChip]}
          onPress={() => setFilter(f)}
        >
          <Text style={[styles.filterText, filter === f && styles.activeFilterText]}>
            {f === 'SMA125' ? '< SMA 125' : f === 'SMA200' ? '< SMA 200' : 'RSI < 30'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderWatchlistInput = () => {
    if (market !== 'watchlist') return null;
    return (
      <View style={styles.watchlistInputContainer}>
        <TextInput
          style={styles.input}
          placeholder="T.ex. TSLA, VOLV-B.ST"
          placeholderTextColor="#666"
          value={newTicker}
          onChangeText={setNewTicker}
          autoCapitalize="characters"
        />
        <TouchableOpacity style={styles.addButton} onPress={addTicker}>
          <Text style={styles.addButtonText}>Lägg till</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmptyState = () => {
    if (loading) return null;
    if (market === 'watchlist' && watchlist.length === 0) {
       return (
         <View style={styles.emptyContainer}>
           <Text style={styles.emptyEmoji}>👀</Text>
           <Text style={styles.emptyText}>Din bevakningslista är tom. Lägg till aktier ovan!</Text>
         </View>
       );
    }
    if (error) {
       return (
         <View style={styles.emptyContainer}>
           <Text style={styles.emptyText}>⚠️ Ett fel uppstod: {error}</Text>
         </View>
       );
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>🚀</Text>
        <Text style={styles.emptyText}>
          Inga aktier matchar ditt filter just nu!
        </Text>
      </View>
    );
  };

  const renderItem = ({ item }: { item: StockData }) => {
    const isExpanded = expandedTicker === item.ticker;
    const chartData = item.chartHistory ? item.chartHistory.map((d, i) => ({ value: d.close, label: i % 5 === 0 ? '' : '' })) : [];

    return (
      <TouchableOpacity 
        style={styles.card} 
        activeOpacity={0.8}
        onPress={() => setExpandedTicker(isExpanded ? null : item.ticker)}
      >
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.ticker}>{item.ticker.replace('.ST', '')}</Text>
            <Text style={styles.companyName}>{item.companyName}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {filter === 'RSI' ? `RSI: ${item.rsi?.toFixed(1) || '-'}` : `${item.diffPercent125?.toFixed(2) || '-'}%`}
              </Text>
            </View>
            {market === 'watchlist' && (
              <TouchableOpacity onPress={() => removeTicker(item.ticker)}>
                <Text style={styles.removeText}>Ta bort</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        <View style={styles.priceRow}>
          <View style={styles.priceCol}>
            <Text style={styles.priceLabel}>Nuvarande kurs</Text>
            <Text style={styles.priceValue}>{item.currentPrice?.toFixed(2) || '-'} kr</Text>
          </View>
          <View style={styles.priceCol}>
            <Text style={styles.priceLabel}>{filter === 'SMA200' ? 'SMA 200' : 'SMA 125'}</Text>
            <Text style={styles.smaValue}>{(filter === 'SMA200' ? item.sma200 : item.sma125)?.toFixed(2) || '-'} kr</Text>
          </View>
        </View>

        {isExpanded && chartData.length > 0 && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Senaste 30 dagarna</Text>
            <LineChart
              data={chartData}
              width={280}
              height={120}
              color="#007AFF"
              thickness={2}
              hideDataPoints
              hideRules
              hideYAxisText
              yAxisColor="transparent"
              xAxisColor="transparent"
            />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Screener</Text>
        <Text style={styles.headerSubtitle}>Uppdaterad: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString('sv-SE', {hour: '2-digit', minute:'2-digit'}) : 'Hämtar...'}</Text>
      </View>
      
      {renderTabs()}
      {renderWatchlistInput()}
      {renderFilters()}

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Analyserar marknaden...</Text>
        </View>
      ) : (
        <FlatList
          data={getFilteredData()}
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
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#333',
  },
  activeTab: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    color: '#8E8E93',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#007AFF',
  },
  watchlistInputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    color: '#FFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
  },
  addButton: {
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFF',
    fontWeight: '700',
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  activeFilterChip: {
    backgroundColor: 'rgba(0, 122, 255, 0.15)',
    borderColor: '#007AFF',
  },
  filterText: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '600',
  },
  activeFilterText: {
    color: '#007AFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#8E8E93',
    marginTop: 12,
    fontSize: 16,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    color: '#34C759',
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  ticker: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  companyName: {
    color: '#8E8E93',
    fontSize: 14,
    marginTop: 2,
    maxWidth: 200,
  },
  badge: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  badgeText: {
    color: '#FF3B30',
    fontWeight: '700',
    fontSize: 14,
  },
  removeText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 8,
    textDecorationLine: 'underline',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 12,
  },
  priceCol: {
    flex: 1,
  },
  priceLabel: {
    color: '#8E8E93',
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  smaValue: {
    color: '#FF9500',
    fontSize: 16,
    fontWeight: '600',
  },
  chartContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
    alignItems: 'center',
  },
  chartTitle: {
    color: '#8E8E93',
    fontSize: 12,
    marginBottom: 10,
    alignSelf: 'flex-start',
  }
});
