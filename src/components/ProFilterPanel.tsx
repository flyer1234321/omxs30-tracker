import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Modal,
  SafeAreaView,
} from 'react-native';
import { HintedTouchable } from '@/components/HintedTouchable';
import {
  applyProFilter,
  getActiveFilterCount,
  type ProFilter,
} from '@/lib/pro-filter';
import { formatNumericInput, parseNumericInput } from '@/lib/numeric-input';
import { colors as palette } from '@/theme';

export { applyProFilter, type ProFilter };

const C = palette;

export interface PresetStrategy {
  id: string;
  name: string;
  icon: string;
  description: string;
  filter: ProFilter;
}

export const PRESET_STRATEGIES: PresetStrategy[] = [
  {
    id: 'deep_value',
    name: 'Lågt P/E + låg RSI',
    icon: '▼',
    description: 'P/E högst 15 och RSI under 30. Visar prispress, inte bevisat värde',
    filter: { peMax: 15, rsiMax: 30 },
  },
  {
    id: 'trend_breakout',
    name: 'Stark trend',
    icon: '↗',
    description: 'Över SMA50 + Nära 52v High + Hög volym',
    filter: { aboveSMA50: true, near52wHigh: true, volAboveAvg: true },
  },
  {
    id: 'dividend_discount',
    name: 'Hög utdelning + låg RSI',
    icon: '%',
    description: 'Direktavkastning över 4 % och RSI under 40. Utdelningen kan sänkas',
    filter: { divYieldMin: 4, rsiMax: 40 },
  },
  {
    id: 'oversold_bounce',
    name: 'Kraftigt pressad',
    icon: '↓',
    description: 'RSI under 25 och kurs under SMA 125. Ingen vändning är bekräftad',
    filter: { rsiMax: 25, belowSMA125: true },
  },
];

interface ProFilterPanelProps {
  activeFilter: ProFilter;
  onFilterChange: (filter: ProFilter) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onShowResults: () => void;
  candidateCount: number;
  matchCount: number;
}

const FILTER_HELP = [
  ['RSI min/max', 'RSI (14 dagar) mäter styrkan i de senaste kursrörelserna på skalan 0-100. Lågt RSI kan indikera översålt, högt RSI starkt momentum. Min och max kan kombineras till ett intervall.'],
  ['P/E max', 'Visar bara bolag med positivt trailing P/E på eller under gränsen. Bolag med negativ vinst eller saknat P/E utesluts.'],
  ['Utdelning min', 'Minsta direktavkastning i procent. Exempel: 4 visar bara aktier med minst 4 % direktavkastning enligt tillgänglig marknadsdata.'],
  ['Volatilitet max', 'Årsomräknad volatilitet baserad på de senaste 20 handelsdagarnas logavkastning. Lägre tal betyder historiskt mindre kursrörelser, inte lägre framtida risk.'],
  ['SMA 50 / 125 / 200', 'Kurs över respektive enkelt glidande medelvärde. SMA 50 fångar kortare trend, SMA 125 cirka ett halvår och SMA 200 cirka ett år.'],
  ['Hög volym', 'Senaste handelsvolymen måste överstiga 150 % av snittet för de föregående 20 handelsdagarna.'],
  ['Nära 52v High / Low', 'Inom 5 % från 52-veckorshögsta respektive lägsta. High används ofta för trendstyrka, Low för möjliga vändnings- eller värdecases.'],
];

function NumberInput({ label, value, onChange, placeholder }: {
  label: string; value: number | undefined; onChange: (v: number | undefined) => void; placeholder: string;
}) {
  // Fältet håller sin egen text så att halvskriven inmatning som "3," inte
  // skrivs över medan man skriver.
  const [text, setText] = useState(() => formatNumericInput(value));

  useEffect(() => {
    setText((current) => (parseNumericInput(current) === value ? current : formatNumericInput(value)));
  }, [value]);

  const handleChange = (next: string) => {
    setText(next);
    onChange(parseNumericInput(next));
  };

  return (
    <View style={st.inputGroup}>
      <Text style={st.inputLabel}>{label}</Text>
      <TextInput
        style={st.numberInput}
        value={text}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor={C.textMuted}
        keyboardType="decimal-pad"
        inputMode="decimal"
        accessibilityLabel={label}
        accessibilityHint={`Ange ett tal för filtret ${label}. Lämna tomt för att inte använda villkoret.`}
      />
    </View>
  );
}

function ToggleChip({ label, hint, active, onToggle }: {
  label: string; hint: string; active: boolean; onToggle: () => void;
}) {
  return (
    <HintedTouchable
      style={[st.toggleChip, active && st.toggleChipActive]}
      onPress={onToggle}
      accessibilityLabel={`${active ? 'Ta bort' : 'Aktivera'} trendfilter: ${label}`}
      hint={hint}
    >
      <Text style={[st.toggleChipText, active && st.toggleChipTextActive]}>{label}</Text>
    </HintedTouchable>
  );
}

export default function ProFilterPanel({ activeFilter, onFilterChange, isExpanded, onToggleExpand, onShowResults, candidateCount, matchCount }: ProFilterPanelProps) {
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const filterCount = getActiveFilterCount(activeFilter);
  const activeFilterLabels = [
    activeFilter.rsiMax != null ? `RSI <= ${activeFilter.rsiMax}` : null,
    activeFilter.rsiMin != null ? `RSI >= ${activeFilter.rsiMin}` : null,
    activeFilter.peMax != null ? `P/E <= ${activeFilter.peMax}` : null,
    activeFilter.peMin != null ? `P/E >= ${activeFilter.peMin}` : null,
    activeFilter.divYieldMin != null ? `Utdelning >= ${activeFilter.divYieldMin}%` : null,
    activeFilter.volatilityMax != null ? `Volatilitet <= ${activeFilter.volatilityMax}%` : null,
    activeFilter.aboveSMA50 ? 'Över SMA 50' : null,
    activeFilter.aboveSMA125 ? 'Över SMA 125' : null,
    activeFilter.aboveSMA200 ? 'Över SMA 200' : null,
    activeFilter.belowSMA125 ? 'Under SMA 125' : null,
    activeFilter.volAboveAvg ? 'Hög volym' : null,
    activeFilter.near52wHigh ? 'Nära 52v High' : null,
    activeFilter.near52wLow ? 'Nära 52v Low' : null,
  ].filter((label): label is string => Boolean(label));

  const applyPreset = (preset: PresetStrategy) => {
    if (activePreset === preset.id) {
      setActivePreset(null);
      onFilterChange({});
    } else {
      setActivePreset(preset.id);
      onFilterChange(preset.filter);
    }
  };

  const updateFilter = (partial: Partial<ProFilter>) => {
    setActivePreset(null);
    onFilterChange({ ...activeFilter, ...partial });
  };

  const clearAll = () => {
    setActivePreset(null);
    onFilterChange({});
  };

  return (
    <View style={st.container}>
      {/* Toggle button */}
      <HintedTouchable style={st.toggleBar} onPress={onToggleExpand} accessibilityLabel={isExpanded ? 'Fäll ihop Pro Filter' : 'Öppna Pro Filter'} hint={isExpanded ? 'Fäller ihop de avancerade filtren.' : 'Öppnar avancerade filter och färdiga strategier. Alla aktiva villkor måste vara uppfyllda.'}>
        <View style={st.toggleLeft}>
          <Text style={st.toggleIcon}>⚡</Text>
          <Text style={st.toggleLabel}>Pro Filter</Text>
          {filterCount > 0 && (
            <View style={st.filterCountBadge}>
              <Text style={st.filterCountText}>{filterCount}</Text>
            </View>
          )}
        </View>
        <Text style={st.toggleArrow}>{isExpanded ? '▲' : '▼'}</Text>
      </HintedTouchable>

      {isExpanded && (
        <View style={st.panel}>
          {/* Preset strategies */}
          <Text style={st.sectionTitle}>STRATEGIER</Text>
          <Text style={st.sectionHelp}>Färdiga sökningar som kombinerar flera villkor. De sorterar fram kandidater men är inte köpråd.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.presetScroll}>
            {PRESET_STRATEGIES.map(p => (
              <HintedTouchable
                key={p.id}
                style={[st.presetCard, activePreset === p.id && st.presetCardActive]}
                onPress={() => applyPreset(p)}
                accessibilityLabel={`${activePreset === p.id ? 'Ta bort strategi' : 'Aktivera strategi'}: ${p.name}`}
                hint={`${p.description}. ${activePreset === p.id ? 'Tryck för att ta bort strategins villkor.' : 'Tryck för att använda dessa villkor.'}`}
              >
                <Text style={st.presetIcon}>{p.icon}</Text>
                <Text style={[st.presetName, activePreset === p.id && st.presetNameActive]}>{p.name}</Text>
                <Text style={st.presetDesc}>{p.description}</Text>
              </HintedTouchable>
            ))}
          </ScrollView>

          {/* Numeric filters */}
          <Text style={st.sectionTitle}>TEKNISKA FILTER</Text>
          <Text style={st.sectionHelp}>RSI beskriver styrkan i den senaste kursrörelsen. Lågt RSI kan fortsätta vara lågt i en fallande trend.</Text>
          <View style={st.filterRow}>
            <NumberInput label="RSI max" value={activeFilter.rsiMax} onChange={v => updateFilter({ rsiMax: v })} placeholder="t.ex. 30" />
            <NumberInput label="RSI min" value={activeFilter.rsiMin} onChange={v => updateFilter({ rsiMin: v })} placeholder="t.ex. 20" />
          </View>

          <Text style={st.sectionTitle}>FUNDAMENTALA FILTER</Text>
          <Text style={st.sectionHelp}>P/E och direktavkastning bygger på senast tillgängliga vinst- och utdelningsdata. Lågt P/E är inte automatiskt billigt.</Text>
          <View style={st.filterRow}>
            <NumberInput label="P/E max" value={activeFilter.peMax} onChange={v => updateFilter({ peMax: v })} placeholder="t.ex. 15" />
            <NumberInput label="Utdeln. min %" value={activeFilter.divYieldMin} onChange={v => updateFilter({ divYieldMin: v })} placeholder="t.ex. 4" />
          </View>

          <Text style={st.sectionTitle}>RISKFILTER</Text>
          <Text style={st.sectionHelp}>Volatilitet visar historiska svängningar och är inte ett tak för framtida risk.</Text>
          <View style={st.singleFilterRow}>
            <NumberInput label="Volatilitet max %" value={activeFilter.volatilityMax} onChange={v => updateFilter({ volatilityMax: v })} placeholder="t.ex. 30" />
          </View>

          {/* Toggle filters */}
          <Text style={st.sectionTitle}>TRENDFILTER</Text>
          <Text style={st.sectionHelp}>Beskriver kursens läge mot historiska nivåer. Trendfilter är bakåtblickande och förutspår inte nästa rörelse.</Text>
          <View style={st.chipWrap}>
            <ToggleChip label="Över SMA 50" hint="Visar bara aktier med kurs över sitt 50-dagars glidande medelvärde, en kortare trendindikator." active={!!activeFilter.aboveSMA50} onToggle={() => updateFilter({ aboveSMA50: !activeFilter.aboveSMA50 })} />
            <ToggleChip label="Över SMA 125" hint="Visar bara aktier med kurs över sitt 125-dagars glidande medelvärde, ungefär ett halvårssnitt." active={!!activeFilter.aboveSMA125} onToggle={() => updateFilter({ aboveSMA125: !activeFilter.aboveSMA125 })} />
            <ToggleChip label="Över SMA 200" hint="Visar bara aktier med kurs över sitt 200-dagars glidande medelvärde, ungefär ett årssnitt." active={!!activeFilter.aboveSMA200} onToggle={() => updateFilter({ aboveSMA200: !activeFilter.aboveSMA200 })} />
            <ToggleChip label="Under SMA 125" hint="Visar bara aktier med kurs under sitt 125-dagars glidande medelvärde." active={!!activeFilter.belowSMA125} onToggle={() => updateFilter({ belowSMA125: !activeFilter.belowSMA125 })} />
            <ToggleChip label="Hög volym" hint="Visar bara aktier där senaste volymen är minst 150 % av snittet för de senaste 20 handelsdagarna." active={!!activeFilter.volAboveAvg} onToggle={() => updateFilter({ volAboveAvg: !activeFilter.volAboveAvg })} />
            <ToggleChip label="Nära 52v High" hint="Visar bara aktier inom 5 % från sin 52-veckorshögsta." active={!!activeFilter.near52wHigh} onToggle={() => updateFilter({ near52wHigh: !activeFilter.near52wHigh })} />
            <ToggleChip label="Nära 52v Low" hint="Visar bara aktier inom 5 % från sin 52-veckorslägsta." active={!!activeFilter.near52wLow} onToggle={() => updateFilter({ near52wLow: !activeFilter.near52wLow })} />
          </View>

          <View style={st.resultRow}>
            <Text style={st.resultText}>{filterCount > 0 ? `${matchCount} träffar av ${candidateCount}` : `${candidateCount} aktier i urvalet`}</Text>
            <HintedTouchable style={st.helpButton} onPress={() => setShowHelp(true)} accessibilityLabel="Förklaring av Pro Filter" hint="Öppnar en detaljerad förklaring av alla strategier och filter.">
              <Text style={st.helpButtonText}>ⓘ</Text>
            </HintedTouchable>
          </View>
          {filterCount > 0 && matchCount === 0 && (
            <Text style={st.noMatchesText}>Alla aktiva villkor måste vara uppfyllda. Prova Sverige brett eller ta bort ett villkor.</Text>
          )}

          {activeFilterLabels.length > 0 && (
            <View style={st.activeSummary}>
              <Text style={st.activeSummaryLabel}>AKTIVA VILLKOR</Text>
              <View style={st.activeSummaryChips}>
                {activeFilterLabels.map((label) => <View key={label} style={st.activeSummaryChip}><Text style={st.activeSummaryText}>{label}</Text></View>)}
              </View>
            </View>
          )}

          {/* Active filters summary */}
          {filterCount > 0 && (
            <View style={st.filterActions}>
              <HintedTouchable style={st.showResultsBtn} onPress={onShowResults} accessibilityLabel={`Visa ${matchCount} filterträffar`} hint="Fäller ihop Pro Filter så att aktierna som matchar villkoren syns i tabellen.">
                <Text style={st.showResultsText}>Visa {matchCount} träffar</Text>
              </HintedTouchable>
              <HintedTouchable style={st.clearBtn} onPress={clearAll} accessibilityLabel="Rensa alla Pro Filter" hint="Tar bort samtliga avancerade filter och visar hela urvalet igen.">
                <Text style={st.clearBtnText}>✕ Rensa alla filter ({filterCount})</Text>
              </HintedTouchable>
            </View>
          )}
        </View>
      )}

      <Modal visible={showHelp} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowHelp(false)}>
        <SafeAreaView style={st.helpSafe}>
          <View style={st.helpHeader}>
            <Text style={st.helpTitle}>Pro Filter</Text>
            <HintedTouchable style={st.helpClose} onPress={() => setShowHelp(false)} accessibilityLabel="Stäng förklaringen" hint="Stänger förklaringen av Pro Filter.">
              <Text style={st.helpCloseText}>✕</Text>
            </HintedTouchable>
          </View>
          <ScrollView contentContainerStyle={st.helpBody}>
            <Text style={st.helpIntro}>Varje aktivt villkor kombineras med OCH. Saknar en aktie data för ett aktivt villkor exkluderas den, vilket gör att strikta strategier ibland kan ge noll träffar.</Text>
            <Text style={st.helpSection}>STRATEGIER</Text>
            {PRESET_STRATEGIES.map((strategy) => (
              <View key={strategy.id} style={st.helpItem}>
                <Text style={st.helpItemTitle}>{strategy.icon} {strategy.name}</Text>
                <Text style={st.helpItemText}>{strategy.description}. Det är ett färdigt urval, inte ett köpråd.</Text>
              </View>
            ))}
            <Text style={st.helpSection}>FILTER</Text>
            {FILTER_HELP.map(([title, detail]) => (
              <View key={title} style={st.helpItem}>
                <Text style={st.helpItemTitle}>{title}</Text>
                <Text style={st.helpItemText}>{detail}</Text>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  container: { marginBottom: 4 },
  toggleBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleIcon: { fontSize: 14 },
  toggleLabel: { color: C.textPrimary, fontSize: 13, fontWeight: '600' },
  toggleArrow: { color: C.textMuted, fontSize: 10 },
  filterCountBadge: {
    backgroundColor: C.accent, borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 1, minWidth: 20, alignItems: 'center',
  },
  filterCountText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  panel: { backgroundColor: C.surfaceAlt, paddingHorizontal: 16, paddingVertical: 12 },

  sectionTitle: {
    color: C.textMuted, fontSize: 10, fontWeight: '700',
    letterSpacing: 1.2, marginBottom: 4, marginTop: 12,
  },
  sectionHelp: { color: C.textSecondary, fontSize: 11, lineHeight: 16, marginBottom: 8, maxWidth: 760 },

  presetScroll: { marginBottom: 8, marginHorizontal: -4 },
  presetCard: {
    backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    padding: 12, marginHorizontal: 4, width: 140,
  },
  presetCardActive: { borderColor: C.accent, backgroundColor: C.accentBg },
  presetIcon: { fontSize: 18, marginBottom: 4 },
  presetName: { color: C.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 2 },
  presetNameActive: { color: C.accent },
  presetDesc: { color: C.textMuted, fontSize: 11 },

  filterRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  singleFilterRow: { flexDirection: 'row', maxWidth: 520, marginBottom: 8 },
  inputGroup: { flex: 1 },
  inputLabel: { color: C.textSecondary, fontSize: 11, marginBottom: 4 },
  numberInput: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 8,
    color: C.textPrimary, fontSize: 14, paddingHorizontal: 12, paddingVertical: 8,
    fontVariant: ['tabular-nums'],
  },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  toggleChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.surface,
  },
  toggleChipActive: { borderColor: C.accent, backgroundColor: C.accentBg },
  toggleChipText: { color: C.textSecondary, fontSize: 12, fontWeight: '500' },
  toggleChipTextActive: { color: C.accent },

  clearBtn: {
    alignItems: 'center', paddingVertical: 10, marginTop: 8,
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'rgba(239,68,68,0.05)',
  },
  clearBtnText: { color: C.negative, fontSize: 13, fontWeight: '600' },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  resultText: { color: C.textSecondary, fontSize: 12, fontVariant: ['tabular-nums'] },
  helpButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  helpButtonText: { color: C.accent, fontSize: 19 },
  noMatchesText: { color: C.warning, fontSize: 12, lineHeight: 18, marginTop: 4 },
  activeSummary: { marginTop: 12 },
  activeSummaryLabel: { color: C.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.1, marginBottom: 6 },
  activeSummaryChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  activeSummaryChip: { backgroundColor: C.accentBg, borderWidth: 1, borderColor: C.accentBorder, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 5 },
  activeSummaryText: { color: '#93c5fd', fontSize: 11, fontWeight: '600' },
  filterActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  showResultsBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 40, borderRadius: 6, backgroundColor: C.accent },
  showResultsText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  helpSafe: { flex: 1, backgroundColor: C.bg },
  helpHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  helpTitle: { color: C.textPrimary, fontSize: 20, fontWeight: '700' },
  helpClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  helpCloseText: { color: C.textPrimary, fontSize: 20 },
  helpBody: { padding: 20, paddingBottom: 48 },
  helpIntro: { color: C.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 20 },
  helpSection: { color: C.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.1, marginBottom: 8, marginTop: 12 },
  helpItem: { borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 12 },
  helpItemTitle: { color: C.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  helpItemText: { color: C.textSecondary, fontSize: 13, lineHeight: 19 },
});
