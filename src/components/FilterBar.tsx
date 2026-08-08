import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, Modal, SafeAreaView } from 'react-native';
import { HintedTouchable } from '@/components/HintedTouchable';
import { useAppTheme } from '@/components/AppTheme';
import { useAppLanguage } from '@/components/AppLanguage';
import { colors, fonts, spacing, radius } from '../theme';
import type { MarketId } from '@/types/stock';

interface FilterBarProps {
  market: MarketId;
  onMarketChange: (market: MarketId) => void;
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

const MARKETS: { id: MarketId; sv: string; en: string; hintSv: string; hintEn: string }[] = [
  { id: 'omxs30', sv: 'OMXS30', en: 'OMXS30', hintSv: 'Visar de 30 största och mest omsatta aktierna på Stockholmsbörsen.', hintEn: 'Shows the 30 largest and most actively traded shares on Nasdaq Stockholm.' },
  { id: 'swe_broad', sv: 'Sverige brett', en: 'Sweden broad', hintSv: 'Visar ett bredare urval av svenska aktier än OMXS30.', hintEn: 'Shows a broader selection of Swedish shares than OMXS30.' },
  { id: 'dji', sv: 'USA', en: 'US', hintSv: 'Visar de amerikanska aktier som ingår i Dow Jones Industrial Average.', hintEn: 'Shows US shares included in the Dow Jones Industrial Average.' },
  { id: 'tech', sv: 'Tech', en: 'Tech', hintSv: 'Visar ett urval av stora teknikaktier.', hintEn: 'Shows a selection of large technology companies.' },
  { id: 'swe_fastigheter', sv: 'Fastigheter', en: 'Real estate', hintSv: 'Visar svenska fastighetsbolag.', hintEn: 'Shows Swedish real-estate companies.' },
  { id: 'watchlist', sv: 'Min Lista', en: 'My List', hintSv: 'Visar dina personliga favoriter. Varje inloggad användare har sin egen lista.', hintEn: 'Shows your personal favourites. Each signed-in user has a separate list.' },
  { id: 'holdings', sv: 'Mitt Innehav', en: 'My Holdings', hintSv: 'Visar bolag där du har registrerat ett innehav. Varje användare har sin egen lista.', hintEn: 'Shows companies where you have registered a holding. Each user has a separate list.' },
];

export function FilterBar({
  market,
  onMarketChange,
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
  const { mode, toggleMode } = useAppTheme();
  const { language, locale, toggleLanguage, t } = useAppLanguage();

  const formattedTime = lastUpdated ? new Date(lastUpdated).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }) : '--:--:--';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>📊 Screener</Text>
          <View style={styles.headerActions}>
            <HintedTouchable
              style={styles.themeButton}
              onPress={toggleLanguage}
              accessibilityLabel={t('Byt språk till engelska', 'Switch language to Swedish')}
              hint={t('Visar hela appen på engelska. Valet sparas på den här enheten.', 'Shows the entire app in Swedish. The choice is saved on this device.')}
            >
              <Text style={styles.themeButtonText}>{language === 'sv' ? 'English' : 'Svenska'}</Text>
            </HintedTouchable>
            <HintedTouchable
              style={styles.themeButton}
              onPress={toggleMode}
              accessibilityLabel={mode === 'dark' ? t('Byt till ljust tema', 'Switch to light theme') : t('Byt till mörkt tema', 'Switch to dark theme')}
              hint={mode === 'dark' ? t('Visar appen med ljus bakgrund och mörk text.', 'Uses a light background with dark text.') : t('Visar appen med mörk bakgrund och ljus text.', 'Uses a dark background with light text.')}
            >
              <Text style={styles.themeButtonText}>{mode === 'dark' ? t('Ljust', 'Light') : t('Mörkt', 'Dark')}</Text>
            </HintedTouchable>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{filteredCount} {t('av', 'of')} {totalCount}</Text>
            </View>
            <HintedTouchable style={styles.signOutButton} onPress={onOpenAlertSettings} accessibilityLabel={t('Inställningar för e-postvarningar', 'Email alert settings')} hint={t('Aktivera eller stäng av daglig e-postbevakning av din personliga favoritlista.', 'Enable or disable daily email monitoring for your personal favourites.')}>
              <Text style={styles.signOutText}>{t('Varningar', 'Alerts')}</Text>
            </HintedTouchable>
            {isAdmin && (
              <HintedTouchable style={styles.adminButton} onPress={onOpenAdmin} accessibilityLabel={t('Administration', 'Administration')} hint={t('Visar konfigurationsstatus och låter dig köra bevakningsjobbet manuellt.', 'Shows configuration status and lets you run the monitoring job manually.')}>
                <Text style={styles.adminText}>Admin</Text>
              </HintedTouchable>
            )}
            <HintedTouchable style={styles.signOutButton} onPress={onSignOut} accessibilityLabel={t('Logga ut', 'Sign out')} hint={t('Loggar ut från din användare på den här enheten.', 'Signs your account out on this device.')}>
              <Text style={styles.signOutText}>{t('Logga ut', 'Sign out')}</Text>
            </HintedTouchable>
          </View>
        </View>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, marketOpen ? styles.statusDotOpen : styles.statusDotClosed]} />
          <Text style={styles.subtitle}>
            {marketOpen ? t('Börsen öppen', 'Market open') : t('Börsen stängd', 'Market closed')} • {t('Uppdaterad', 'Updated')} {formattedTime} • {gradeACount} {t('med rekylläge A', 'with pullback grade A')}
          </Text>
        </View>
        <Text style={styles.delayNote}>{t('Kursdata kommer från Yahoo Finance och kan vara fördröjd.', 'Market data is provided by Yahoo Finance and may be delayed.')}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabContent}>
        {MARKETS.map((m) => (
          <HintedTouchable
            key={m.id}
            style={[styles.tab, market === m.id && styles.activeTab]}
            onPress={() => onMarketChange(m.id)}
            accessibilityLabel={`${t('Välj marknad', 'Select market')}: ${t(m.sv, m.en)}`}
            hint={t(m.hintSv, m.hintEn)}
          >
            <Text style={[styles.tabText, market === m.id && styles.activeTabText]}>{t(m.sv, m.en)}</Text>
          </HintedTouchable>
        ))}
      </ScrollView>



      {market === 'watchlist' && (
        <View style={styles.searchSection}>
          <TextInput
            style={styles.searchInput}
            placeholder={t('Sök aktie att lägga till...', 'Search for a share to add...')}
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={onSearchChange}
            accessibilityLabel={t('Sök efter aktie att lägga till i Min Lista', 'Search for a share to add to My List')}
            accessibilityHint={t('Skriv bolagsnamn eller ticker. Välj sedan en träff för att lägga till den i dina favoriter.', 'Enter a company name or ticker, then select a result to add it to your favourites.')}
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
