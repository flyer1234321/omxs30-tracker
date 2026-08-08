import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, Modal, SafeAreaView } from 'react-native';
import { HintedTouchable } from '@/components/HintedTouchable';
import { useAppTheme } from '@/components/AppTheme';
import { colors, fonts, spacing, radius } from '../theme';
import type { MarketId } from '@/types/stock';

interface FilterBarProps {
  market: MarketId;
  onMarketChange: (market: MarketId) => void;
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
  marketOpen: boolean;
  isAdmin: boolean;
  onSignOut: () => void;
  onOpenAlertSettings: () => void;
  onOpenAdmin: () => void;
}

const MARKETS: { id: MarketId; label: string; hint: string }[] = [
  { id: 'omxs30', label: 'OMXS30', hint: 'Visar de 30 största och mest omsatta aktierna på Stockholmsbörsen.' },
  { id: 'swe_broad', label: 'Sverige brett', hint: 'Visar ett bredare urval av svenska aktier än OMXS30.' },
  { id: 'dji', label: 'USA', hint: 'Visar de amerikanska aktier som ingår i Dow Jones Industrial Average.' },
  { id: 'tech', label: 'Tech', hint: 'Visar ett urval av stora teknikaktier.' },
  { id: 'swe_fastigheter', label: 'Fastigheter', hint: 'Visar svenska fastighetsbolag.' },
  { id: 'watchlist', label: 'Min Lista', hint: 'Visar dina personliga favoriter. Varje inloggad användare har sin egen lista.' },
];

const FILTERS = [
  { id: 'all', label: 'Alla', hint: 'Tar bort snabbfiltret och visar hela det valda marknadsurvalet.' },
  { id: 'gradeA', label: 'Rekyl A', hint: 'Visar endast aktier med det tydligaste rekylläget. Det betyder att kursen fallit mycket, inte att bolaget är bäst.' },
  { id: 'gradeAB', label: 'A + B', hint: 'Visar aktier med rekylläge A eller B.' },
  { id: 'underSMA', label: 'Under SMA', hint: 'Visar aktier vars kurs ligger under SMA 125, ungefär ett halvårssnitt.' },
  { id: 'oversold', label: 'RSI < 30', hint: 'Visar aktier med RSI under 30, vilket kan indikera ett översålt läge.' },
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
  marketOpen,
  isAdmin,
  onSignOut,
  onOpenAlertSettings,
  onOpenAdmin,
}: FilterBarProps) {
  const [showInfoModal, setShowInfoModal] = useState(false);
  const { mode, toggleMode } = useAppTheme();

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
            <HintedTouchable style={styles.modalCloseBtn} onPress={() => setShowInfoModal(false)} accessibilityLabel="Stäng betygsförklaringen" hint="Stänger förklaringen av betygssystemet.">
              <Text style={styles.modalCloseText}>✕</Text>
            </HintedTouchable>
            <Text style={styles.modalTitle}>Rekylläget förklarat</Text>
          </View>
          <ScrollView style={styles.modalBody}>
            <Text style={styles.modalText}>
              Rekylläget (A till F) mäter hur tydligt en aktie fallit tillbaka. Varje aktie kan få upp till 9 poäng från sex grundkriterier och tre tekniska bonusar.
            </Text>
            <Text style={styles.modalText}>
              Läs skalan för vad den är. Fyra av de sex grundkriterierna — fall från toppen, nära årslägsta, lågt RSI och kurs under snittet — reagerar alla på samma sak: att kursen gått ned. Ett A betyder därför att aktien fallit mycket, inte att bolaget är bra. Om fallet är befogat svarar kolumnen Kvalitet på, och den bygger på skuldsättning, kassaflöde och lönsamhet.
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
              <Text style={[styles.gradeBadge, { backgroundColor: '#4CAF5020', color: '#4CAF50' }]}>Rekylläge A</Text>
              <Text style={styles.gradeDesc}>Kräver hög poäng samt positiv vinst och utdelning. Alternativt minst 5 uppfyllda grundkriterier med RSI under 30. I praktiken: ett utdelande bolag med vinst som rasat.</Text>
            </View>
            <View style={styles.gradeBox}>
              <Text style={[styles.gradeBadge, { backgroundColor: '#8BC34A20', color: '#8BC34A' }]}>Rekylläge B/C/D</Text>
              <Text style={styles.gradeDesc}>B ges från 5 poäng, C från 3 poäng och D från 1 poäng. F betyder att inga tydliga signaler hittas.</Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>📊 Screener</Text>
          <View style={styles.headerActions}>
            <HintedTouchable
              style={styles.themeButton}
              onPress={toggleMode}
              accessibilityLabel={mode === 'dark' ? 'Byt till ljust tema' : 'Byt till mörkt tema'}
              hint={mode === 'dark' ? 'Visar appen med ljus bakgrund och mörk text.' : 'Visar appen med mörk bakgrund och ljus text.'}
            >
              <Text style={styles.themeButtonText}>{mode === 'dark' ? 'Ljust' : 'Mörkt'}</Text>
            </HintedTouchable>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{filteredCount} av {totalCount}</Text>
            </View>
            <HintedTouchable style={styles.signOutButton} onPress={onOpenAlertSettings} accessibilityLabel="Inställningar för e-postvarningar" hint="Aktivera eller stäng av daglig e-postbevakning av din personliga favoritlista.">
              <Text style={styles.signOutText}>Varningar</Text>
            </HintedTouchable>
            {isAdmin && (
              <HintedTouchable style={styles.adminButton} onPress={onOpenAdmin} accessibilityLabel="Administration" hint="Visar konfigurationsstatus och låter dig köra bevakningsjobbet manuellt.">
                <Text style={styles.adminText}>Admin</Text>
              </HintedTouchable>
            )}
            <HintedTouchable style={styles.signOutButton} onPress={onSignOut} accessibilityLabel="Logga ut" hint="Loggar ut från din användare på den här enheten.">
              <Text style={styles.signOutText}>Logga ut</Text>
            </HintedTouchable>
          </View>
        </View>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, marketOpen ? styles.statusDotOpen : styles.statusDotClosed]} />
          <Text style={styles.subtitle}>
            {marketOpen ? 'Börsen öppen' : 'Börsen stängd'} • Uppdaterad {formattedTime} • {gradeACount} med rekylläge A
          </Text>
        </View>
        <Text style={styles.delayNote}>Kursdata kommer från Yahoo Finance och kan vara fördröjd.</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabContent}>
        {MARKETS.map((m) => (
          <HintedTouchable
            key={m.id}
            style={[styles.tab, market === m.id && styles.activeTab]}
            onPress={() => onMarketChange(m.id)}
            accessibilityLabel={`Välj marknad: ${m.label}`}
            hint={m.hint}
          >
            <Text style={[styles.tabText, market === m.id && styles.activeTabText]}>{m.label}</Text>
          </HintedTouchable>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {FILTERS.map((f) => (
          <HintedTouchable
            key={f.id}
            style={[styles.chip, filter === f.id && styles.activeChip]}
            onPress={() => onFilterChange(f.id)}
            accessibilityLabel={`Snabbfilter: ${f.label}`}
            hint={f.hint}
          >
            <Text style={[styles.chipText, filter === f.id && styles.activeChipText]}>{f.label}</Text>
          </HintedTouchable>
        ))}
        <HintedTouchable style={styles.infoBtn} onPress={() => setShowInfoModal(true)} accessibilityLabel="Förklaring av rekylläget" hint="Öppnar en förklaring av hur skalan A till F räknas fram och vad den faktiskt mäter.">
          <Text style={styles.infoBtnText}>❔ Rekyl</Text>
        </HintedTouchable>
      </ScrollView>

      {market === 'watchlist' && (
        <View style={styles.searchSection}>
          <TextInput
            style={styles.searchInput}
            placeholder="Sök aktie att lägga till..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={onSearchChange}
            accessibilityLabel="Sök efter aktie att lägga till i Min Lista"
            accessibilityHint="Skriv bolagsnamn eller ticker. Välj sedan en träff för att lägga till den i dina favoriter."
          />
          
          {isSearching && <ActivityIndicator style={styles.searchLoading} color={colors.accent} />}

          {searchResults.length > 0 && (
            <View style={styles.dropdown}>
              {searchResults.map((result, i) => (
                <HintedTouchable
                  key={result.symbol}
                  style={[styles.dropdownItem, i < searchResults.length - 1 && styles.dropdownItemBorder]}
                  onPress={() => onAddFromSearch(result.symbol)}
                  accessibilityLabel={`Lägg till ${result.shortname} i Min Lista`}
                  hint={`Lägger till ${result.symbol} i din personliga favoritlista.`}
                >
                  <Text style={styles.dropdownSymbol}>{result.symbol}</Text>
                  <Text style={styles.dropdownName} numberOfLines={1}>{result.shortname}</Text>
                  <Text style={styles.dropdownExchange}>{result.exchange}</Text>
                </HintedTouchable>
              ))}
            </View>
          )}

          {watchlist.length > 0 && (
            <View style={styles.watchlistContainer}>
              {watchlist.map((ticker) => (
                <View key={ticker} style={styles.watchlistItem}>
                  <Text style={styles.watchlistItemText}>{ticker}</Text>
                  <HintedTouchable onPress={() => onRemoveFromWatchlist(ticker)} style={styles.removeBtn} accessibilityLabel={`Ta bort ${ticker} från Min Lista`} hint={`Tar bort ${ticker} från din personliga favoritlista.`}>
                    <Text style={styles.removeBtnText}>×</Text>
                  </HintedTouchable>
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
  headerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: spacing.sm },
  themeButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  themeButtonText: { color: colors.textPrimary, fontSize: 11, fontFamily: fonts.sans, fontWeight: '700' },
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
  adminButton: {
    paddingVertical: spacing.xs, paddingHorizontal: spacing.sm,
    borderWidth: 1, borderColor: colors.accentBorder, borderRadius: radius.sm, backgroundColor: colors.accentBg,
  },
  adminText: { color: colors.accent, fontSize: 12, fontFamily: fonts.sans, fontWeight: '700' },
  signOutText: { color: colors.textSecondary, fontSize: 12, fontFamily: fonts.sans, fontWeight: '600' },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: fonts.sans,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusDotOpen: { backgroundColor: colors.positive },
  statusDotClosed: { backgroundColor: colors.textMuted },
  delayNote: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: fonts.sans,
    marginTop: 2,
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
