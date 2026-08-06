import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  RefreshControl, 
  SafeAreaView,
  ActivityIndicator
} from 'react-native';

interface StockData {
  ticker: string;
  companyName: string;
  currentPrice: number;
  sma125: number;
  diffPercent: number;
}

export default function HomeScreen() {
  const [data, setData] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      // In development, the API route is relative to the Expo host.
      // But since we are on mobile, we need a full URL if running on a real device,
      // or we can use relative if in a web context.
      // Expo Router API routes are served at /api/... on the dev server.
      // We can use localhost/127.0.0.1 for simulators, or a full URL if deployed.
      const url = '/api/omxs30';
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
    fetchData();
    
    // Automatisk uppdatering varje minut (60000 ms)
    const interval = setInterval(() => {
      fetchData();
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return 'Uppdaterar...';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>OMXS30 – Under SMA 6M</Text>
      <Text style={styles.headerSubtitle}>Senast uppdaterad: {formatTime(lastUpdated)}</Text>
    </View>
  );

  const renderEmptyState = () => {
    if (loading) return null;
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
          Börsen är stark! Inga OMXS30-aktier ligger under sitt 6-månaderssnitt just nu.
        </Text>
      </View>
    );
  };

  const renderItem = ({ item }: { item: StockData }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.ticker}>{item.ticker.replace('.ST', '')}</Text>
          <Text style={styles.companyName}>{item.companyName}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.diffPercent.toFixed(2)}%</Text>
        </View>
      </View>
      
      <View style={styles.priceRow}>
        <View style={styles.priceCol}>
          <Text style={styles.priceLabel}>Nuvarande kurs</Text>
          <Text style={styles.priceValue}>{item.currentPrice.toFixed(2)} kr</Text>
        </View>
        <View style={styles.priceCol}>
          <Text style={styles.priceLabel}>SMA 125</Text>
          <Text style={styles.smaValue}>{item.sma125.toFixed(2)} kr</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF3B30" />
          <Text style={styles.loadingText}>Hämtar finansdata...</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.ticker}
          renderItem={renderItem}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#fff"
              colors={['#FF3B30']}
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
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
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
    paddingTop: 80,
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
});
