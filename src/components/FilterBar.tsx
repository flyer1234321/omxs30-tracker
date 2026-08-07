import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { colors, fonts, spacing, radius } from '../theme';

interface FilterBarProps {
  market: 'omxs30' | 'dji' | 'tech' | 'swe_fastigheter' | 'watchlist';
  onMarketChange: (market: string) => void;
  filter: string;
  onFilterChange: (filter: string) => void;
  // Search
  searchQuery: string;
  onSearchChange: (text: string) => void;
  searchResults: Array<{ symbol: string; shortname: string; exchange: string }>;
  isSearching: boolean;
  onAddFromSearch: (symbol: string) => void;
  watchlist: string[];
  onRemoveFromWatchlist: (ticker: string) => void;
  // Stats
  totalCount: number;
  filteredCount: number;
  lastUpdated: number | null;
  gradeACount: number;
}

const MARKETS = [
  { id: 'omxs30', label: 'Sverige' },
  { id: 'dji', label: 'USA' },
  { id: 'tech', label: 'Tech' },
  { id: 'swe_fastigheter', label: 'Fastigheter' },
  { id: 'watchlist', label: 'Min Lista' },
];

const FILTERS = [
  { id: 'all', label: 'Alla' },
  { id: 'gradeA', label: 'Betyg A' },
  { id: 'gradeAB', label: 'A + B' },
  { id: 'underSMA', label: 'Under SMA' },
  { id: 'oversold', label: 'RSI < 30' },
];

export function FilterBar({
  market,
  onMarketChange,
  filter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  searchResults,
  isSearching,
  onAddFromSearch,
  watchlist,
  onRemoveFromWatchlist,
  totalCount,
  filteredCount,
  lastUpdated,
  gradeACount,
}: FilterBarProps) {
  const formattedTime = lastUpdated ? new Date(lastUpdated).toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }) : '--:--:--';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>📊 Screener</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{filteredCount} av {totalCount}</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>Uppdaterad: {formattedTime} • {gradeACount} A-betyg</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabContent}>
        {MARKETS.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={[styles.tab, market === m.id && styles.activeTab]}
            onPress={() => onMarketChange(m.id)}
          >
            <Text style={[styles.tabText, market === m.id && styles.activeTabText]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.id}
            style={[styles.chip, filter === f.id && styles.activeChip]}
            onPress={() => onFilterChange(f.id)}
          >
            <Text style={[styles.chipText, filter === f.id && styles.activeChipText]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {market === 'watchlist' && (
        <View style={styles.searchSection}>
          <TextInput
            style={styles.searchInput}
            placeholder="Sök aktie att lägga till..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={onSearchChange}
          />
          
          {isSearching && <ActivityIndicator style={styles.searchLoading} color={colors.accent} />}

          {searchResults.length > 0 && (
            <View style={styles.dropdown}>
              {searchResults.map((result, i) => (
                <TouchableOpacity
                  key={result.symbol}
                  style={[styles.dropdownItem, i < searchResults.length - 1 && styles.dropdownItemBorder]}
                  onPress={() => onAddFromSearch(result.symbol)}
                >
                  <Text style={styles.dropdownSymbol}>{result.symbol}</Text>
                  <Text style={styles.dropdownName} numberOfLines={1}>{result.shortname}</Text>
                  <Text style={styles.dropdownExchange}>{result.exchange}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {watchlist.length > 0 && (
            <View style={styles.watchlistContainer}>
              {watchlist.map((ticker) => (
                <View key={ticker} style={styles.watchlistItem}>
                  <Text style={styles.watchlistItemText}>{ticker}</Text>
                  <TouchableOpacity onPress={() => onRemoveFromWatchlist(ticker)} style={styles.removeBtn}>
                    <Text style={styles.removeBtnText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.md,
  },
  header: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: fonts.sans,
  },
  countBadge: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: fonts.mono,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: fonts.sans,
  },
  tabScroll: {
    flexGrow: 0,
    marginBottom: spacing.md,
  },
  tabContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeTab: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
  },
  tabText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: colors.textPrimary,
  },
  filterScroll: {
    flexGrow: 0,
  },
  filterContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeChip: {
    backgroundColor: colors.accentBg,
    borderColor: colors.accentBorder,
  },
  chipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: fonts.sans,
  },
  activeChipText: {
    color: colors.accent,
  },
  searchSection: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  searchInput: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontSize: 14,
    fontFamily: fonts.sans,
  },
  searchLoading: {
    position: 'absolute',
    right: spacing.lg + spacing.md,
    top: spacing.md,
  },
  dropdown: {
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    zIndex: 10,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  dropdownItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  dropdownSymbol: {
    color: colors.textPrimary,
    fontFamily: fonts.mono,
    fontWeight: 'bold',
    width: 60,
  },
  dropdownName: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12,
  },
  dropdownExchange: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: fonts.mono,
  },
  watchlistContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  watchlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    paddingVertical: spacing.xs,
  },
  watchlistItemText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontFamily: fonts.mono,
    marginRight: spacing.sm,
  },
  removeBtn: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 12,
  },
});
