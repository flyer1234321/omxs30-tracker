import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Modal, SafeAreaView } from 'react-native';
import { colors, fonts, spacing, radius } from '../theme';

interface FilterBarProps {
  market: 'omxs30' | 'swe_broad' | 'dji' | 'tech' | 'swe_fastigheter' | 'watchlist';
  onMarketChange: (market: string) => void;
  filter: string;
  onFilterChange: (filter: string) => void;
  // Search
  searchQuery: string;
  onSearchChange: (text: string) => void;
  searchResults: { symbol: string; shortname: string; exchange: string }[];
  isSearching: boolean;
  onAddFromSearch: (symbol: string) => void;
  watchlist: string[];
  onRemoveFromWatchlist: (ticker: string) => void;
  // Stats
  totalCount: number;
  filteredCount: number;
  lastUpdated: number | null;
  gradeACount: number;
  onSignOut: () => void;
}

const MARKETS = [
  { id: 'omxs30', label: 'OMXS30' },
  { id: 'swe_broad', label: 'Sverige brett' },
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
  onSignOut,
}: FilterBarProps) {
  const [showInfoModal, setShowInfoModal] = useState(false);

  const formattedTime = lastUpdated ? new Date(lastUpdated).toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }) : '--:--:--';

  return (
    <View style={styles.container}>
      <Modal visible={showInfoModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowInfoModal(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowInfoModal(false)}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Betygssystemet Förklarat</Text>
          </View>
          <ScrollView style={styles.modalBody}>
            <Text style={styles.modalText}>
              Betyget (A, B, C, D, F) baseras på en teknisk och fundamental hälsokontroll. Varje aktie kan få upp till 9 poäng från grundkriterier och tekniska bonusar.
            </Text>
            
            <View style={styles.criteriaBox}>
              <Text style={styles.criteriaTitle}>1. Positiv vinst (P/E)</Text>
              <Text style={styles.criteriaDesc}>Ett positivt P/E-tal visar att bolaget rapporterar vinst. Saknas eller negativt P/E ger ingen poäng.</Text>
            </View>
            <View style={styles.criteriaBox}>
              <Text style={styles.criteriaTitle}>2. Utdelning</Text>
              <Text style={styles.criteriaDesc}>Positiv direktavkastning ger poäng och indikerar ofta ett moget bolag med kassaflöde.</Text>
            </View>
            <View style={styles.criteriaBox}>
              <Text style={styles.criteriaTitle}>3. Fall från topp</Text>
              <Text style={styles.criteriaDesc}>Aktier som har fallit mer än 8 % från 52-veckorshögsta, eller från SMA 125 när 52-veckorsdata saknas, får poäng.</Text>
            </View>
            <View style={styles.criteriaBox}>
              <Text style={styles.criteriaTitle}>4. Nära botten</Text>
              <Text style={styles.criteriaDesc}>Aktier inom 10 % från 52-veckorslägsta får poäng eftersom läget kan indikera ett potentiellt stödområde.</Text>
            </View>
            <View style={styles.criteriaBox}>
              <Text style={styles.criteriaTitle}>5. Översåld RSI</Text>
              <Text style={styles.criteriaDesc}>RSI under 35 ger poäng. RSI under 20 ger dessutom en extra bonuspoäng.</Text>
            </View>
            <View style={styles.criteriaBox}>
              <Text style={styles.criteriaTitle}>6. Under SMA 125</Text>
              <Text style={styles.criteriaDesc}>Kurs under 125-dagars glidande medelvärde ger poäng som möjlig rabatt- eller rekylsignal.</Text>
            </View>
            <View style={styles.criteriaBox}>
              <Text style={styles.criteriaTitle}>Bonusar</Text>
              <Text style={styles.criteriaDesc}>Extra poäng kan ges när kursen ligger nära nedre Bollinger-bandet eller när MACD visar positiv momentumvändning.</Text>
            </View>

            <View style={styles.gradeBox}>
              <Text style={[styles.gradeBadge, { backgroundColor: '#4CAF5020', color: '#4CAF50' }]}>🏆 Betyg A</Text>
              <Text style={styles.gradeDesc}>Kräver hög poäng samt positiv vinst och utdelning. Alternativt minst 5 uppfyllda grundkriterier med RSI under 30.</Text>
            </View>
            <View style={styles.gradeBox}>
              <Text style={[styles.gradeBadge, { backgroundColor: '#8BC34A20', color: '#8BC34A' }]}>✅ Betyg B/C/D</Text>
              <Text style={styles.gradeDesc}>B ges från 5 poäng, C från 3 poäng och D från 1 poäng. F betyder att inga tydliga signaler hittas.</Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>📊 Screener</Text>
          <View style={styles.headerActions}>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{filteredCount} av {totalCount}</Text>
            </View>
            <TouchableOpacity style={styles.signOutButton} onPress={onSignOut}>
              <Text style={styles.signOutText}>Logga ut</Text>
            </TouchableOpacity>
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
        <TouchableOpacity style={styles.infoBtn} onPress={() => setShowInfoModal(true)}>
          <Text style={styles.infoBtnText}>❔ Betyg</Text>
        </TouchableOpacity>
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
  signOutButton: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  signOutText: { color: colors.textSecondary, fontSize: 12, fontFamily: fonts.sans, fontWeight: '600' },
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
  infoBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  infoBtnText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontWeight: 'bold',
  },
  modalSafe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalCloseBtn: {
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  modalCloseText: {
    fontSize: 20,
    color: colors.textPrimary,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: fonts.sans,
  },
  modalBody: {
    padding: spacing.lg,
  },
  modalText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  criteriaBox: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  criteriaTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  criteriaDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  gradeBox: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
  },
  gradeBadge: {
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  gradeDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
