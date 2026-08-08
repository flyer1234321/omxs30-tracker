import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Modal,
  SafeAreaView,
  useWindowDimensions,
} from 'react-native';
import { HintedTouchable } from '@/components/HintedTouchable';
import {
  applyProFilter,
  getActiveFilterCount,
  type ProFilter,
} from '@/lib/pro-filter';
import { formatNumericInput, parseNumericInput } from '@/lib/numeric-input';
import { colors as palette } from '@/theme';
import { useAppLanguage } from '@/components/AppLanguage';

export { applyProFilter, type ProFilter };

const C = palette;

export interface PresetStrategy {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  description: string;
  descriptionEn: string;
  filter: ProFilter;
}

export const PRESET_STRATEGIES: PresetStrategy[] = [
  {
    id: 'deep_value',
    name: 'Lågt P/E + låg RSI',
    nameEn: 'Low P/E + low RSI',
    icon: '▼',
    description: 'P/E högst 15 och RSI under 30. Visar prispress, inte bevisat värde',
    descriptionEn: 'P/E at most 15 and RSI below 30. Shows price pressure, not proven value',
    filter: { peMax: 15, rsiMax: 30 },
  },
  {
    id: 'trend_breakout',
    name: 'Stark trend',
    nameEn: 'Strong trend',
    icon: '↗',
    description: 'Över SMA50 + Nära 52v High + Hög volym',
    descriptionEn: 'Above SMA50 + Near 52w high + High volume',
    filter: { aboveSMA50: true, near52wHigh: true, volAboveAvg: true },
  },
  {
    id: 'dividend_discount',
    name: 'Hög utdelning + låg RSI',
    nameEn: 'High yield + low RSI',
    icon: '%',
    description: 'Direktavkastning över 4 % och RSI under 40. Utdelningen kan sänkas',
    descriptionEn: 'Dividend yield above 4% and RSI below 40. The dividend may be cut',
    filter: { divYieldMin: 4, rsiMax: 40 },
  },
  {
    id: 'oversold_bounce',
    name: 'Kraftigt pressad',
    nameEn: 'Heavily pressured',
    icon: '↓',
    description: 'RSI under 25 och kurs under SMA 125. Ingen vändning är bekräftad',
    descriptionEn: 'RSI below 25 and price below SMA 125. No reversal is confirmed',
    filter: { rsiMax: 25, belowSMA125: true },
  },
];

interface ProFilterPanelProps {
  activeFilter: ProFilter;
  onFilterChange: (filter: ProFilter) => void;
  quickFilter: string;
  onQuickFilterChange: (filter: string) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onShowResults: () => void;
  candidateCount: number;
  matchCount: number;
}

const FILTERS = [
  { id: 'all', sv: 'Alla', en: 'All', hintSv: 'Tar bort snabbfiltret och visar hela det valda marknadsurvalet.', hintEn: 'Clears the quick filter and shows the full selected market universe.' },
  { id: 'gradeA', sv: 'Rekyl A', en: 'Pullback A', hintSv: 'Visar endast aktier med det tydligaste rekylläget. Det betyder att kursen fallit mycket, inte att bolaget är bäst.', hintEn: 'Shows shares with the strongest pullback setup. It means the price has fallen substantially, not that the company is best.' },
  { id: 'gradeAB', sv: 'A + B', en: 'A + B', hintSv: 'Visar aktier med rekylläge A eller B.', hintEn: 'Shows shares with a pullback grade of A or B.' },
  { id: 'underSMA', sv: 'Under SMA', en: 'Below SMA', hintSv: 'Visar aktier vars kurs ligger under SMA 125, ungefär ett halvårssnitt.', hintEn: 'Shows shares trading below SMA 125, roughly a six-month average.' },
  { id: 'oversold', sv: 'RSI < 30', en: 'RSI < 30', hintSv: 'Visar aktier med RSI under 30, vilket kan indikera ett översålt läge.', hintEn: 'Shows shares with RSI below 30, which may indicate an oversold condition.' },
];

const FILTER_HELP = [
  ['RSI min/max', 'RSI (14 dagar) mäter styrkan i de senaste kursrörelserna på skalan 0-100. Lågt RSI kan indikera översålt, högt RSI starkt momentum. Min och max kan kombineras till ett intervall.', 'RSI min/max', 'RSI over 14 sessions measures recent momentum on a 0-100 scale. Low RSI can indicate oversold conditions, while high RSI shows strong momentum.'],
  ['P/E max', 'Visar bara bolag med positivt trailing P/E på eller under gränsen. Bolag med negativ vinst eller saknat P/E utesluts.', 'P/E max', 'Only includes companies with a positive trailing P/E at or below the limit. Missing or negative earnings are excluded.'],
  ['Utdelning min', 'Minsta direktavkastning i procent. Exempel: 4 visar bara aktier med minst 4 % direktavkastning enligt tillgänglig marknadsdata.', 'Dividend yield min', 'Minimum dividend yield in percent. A value of 4 includes shares with a yield of at least 4%.'],
  ['Volatilitet max', 'Årsomräknad volatilitet baserad på de senaste 20 handelsdagarnas logavkastning. Lägre tal betyder historiskt mindre kursrörelser, inte lägre framtida risk.', 'Volatility max', 'Annualised volatility based on the latest 20 sessions. A lower figure means smaller historical moves, not lower future risk.'],
  ['SMA 50 / 125 / 200', 'Kurs över respektive enkelt glidande medelvärde. SMA 50 fångar kortare trend, SMA 125 cirka ett halvår och SMA 200 cirka ett år.', 'SMA 50 / 125 / 200', 'Price above each simple moving average. SMA 50 captures a shorter trend, SMA 125 about six months and SMA 200 about one year.'],
  ['Hög volym', 'Senaste handelsvolymen måste överstiga 150 % av snittet för de föregående 20 handelsdagarna.', 'High volume', 'Latest trading volume must exceed 150% of the preceding 20-session average.'],
  ['Nära 52v High / Low', 'Inom 5 % från 52-veckorshögsta respektive lägsta. High används ofta för trendstyrka, Low för möjliga vändnings- eller värdecases.', 'Near 52w high / low', 'Within 5% of the 52-week high or low. The high often indicates trend strength; the low may highlight reversal or value candidates.'],
];

function NumberInput({ label, value, onChange, placeholder }: {
  label: string; value: number | undefined; onChange: (v: number | undefined) => void; placeholder: string;
}) {
  const { t } = useAppLanguage();
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
        accessibilityHint={t(`Ange ett tal för filtret ${label}. Lämna tomt för att inte använda villkoret.`, `Enter a number for ${label}. Leave blank to ignore this condition.`)}
      />
    </View>
  );
}

function ToggleChip({ label, hint, active, onToggle }: {
  label: string; hint: string; active: boolean; onToggle: () => void;
}) {
  const { t } = useAppLanguage();
  return (
    <HintedTouchable
      style={[st.toggleChip, active && st.toggleChipActive]}
      onPress={onToggle}
      accessibilityLabel={`${active ? t('Ta bort', 'Remove') : t('Aktivera', 'Enable')} ${t('trendfilter', 'trend filter')}: ${label}`}
      hint={hint}
    >
      <Text style={[st.toggleChipText, active && st.toggleChipTextActive]}>{label}</Text>
    </HintedTouchable>
  );
}

export default function ProFilterPanel({ activeFilter, onFilterChange, quickFilter, onQuickFilterChange, isExpanded, onToggleExpand, onShowResults, candidateCount, matchCount }: ProFilterPanelProps) {
  const { height: viewportHeight } = useWindowDimensions();
  // Knappt halva fönstret, så att tabellen alltid syns under panelen.
  const panelMaxHeight = Math.max(220, viewportHeight * 0.45);
  const { language, t } = useAppLanguage();
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const filterCount = getActiveFilterCount(activeFilter);
  const activeFilterLabels = [
    activeFilter.rsiMax != null ? `RSI <= ${activeFilter.rsiMax}` : null,
    activeFilter.rsiMin != null ? `RSI >= ${activeFilter.rsiMin}` : null,
    activeFilter.peMax != null ? `P/E <= ${activeFilter.peMax}` : null,
    activeFilter.peMin != null ? `P/E >= ${activeFilter.peMin}` : null,
    activeFilter.divYieldMin != null ? `${t('Utdelning', 'Dividend yield')} >= ${activeFilter.divYieldMin}%` : null,
    activeFilter.volatilityMax != null ? `${t('Volatilitet', 'Volatility')} <= ${activeFilter.volatilityMax}%` : null,
    activeFilter.aboveSMA50 ? t('Över SMA 50', 'Above SMA 50') : null,
    activeFilter.aboveSMA125 ? t('Över SMA 125', 'Above SMA 125') : null,
    activeFilter.aboveSMA200 ? t('Över SMA 200', 'Above SMA 200') : null,
    activeFilter.belowSMA125 ? t('Under SMA 125', 'Below SMA 125') : null,
    activeFilter.volAboveAvg ? t('Hög volym', 'High volume') : null,
    activeFilter.near52wHigh ? t('Nära 52v High', 'Near 52w high') : null,
    activeFilter.near52wLow ? t('Nära 52v Low', 'Near 52w low') : null,
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
      <HintedTouchable style={st.toggleBar} onPress={onToggleExpand} accessibilityLabel={isExpanded ? t('Fäll ihop Pro Filter', 'Collapse Pro Filter') : t('Öppna Pro Filter', 'Open Pro Filter')} hint={isExpanded ? t('Fäller ihop de avancerade filtren.', 'Collapses the advanced filters.') : t('Öppnar avancerade filter och färdiga strategier. Alla aktiva villkor måste vara uppfyllda.', 'Opens advanced filters and preset strategies. Every active condition must match.')}>
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
        // Panelen har egen scroll och ett tak på höjden. Utan det växte den
        // fritt, klämde tabellen till noll pixlar och lämnade ingen väg
        // tillbaka: sidan i sig scrollar inte.
        <ScrollView
          style={[st.panel, { maxHeight: panelMaxHeight }]}
          contentContainerStyle={st.panelContent}
          showsVerticalScrollIndicator
          nestedScrollEnabled
        >
          <Text style={st.sectionTitle}>{t('SNABBFILTER', 'QUICK FILTERS')}</Text>
          <Text style={st.sectionHelp}>{t('Färdiga filter som döljer bolag från det ordinarie urvalet.', 'Preset filters that hide companies from the standard selection.')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.presetScroll}>
            {FILTERS.map((f) => (
              <HintedTouchable
                key={f.id}
                style={[st.presetCard, quickFilter === f.id && st.presetCardActive]}
                onPress={() => onQuickFilterChange(f.id)}
                accessibilityLabel={`${t('Snabbfilter', 'Quick filter')}: ${t(f.sv, f.en)}`}
                hint={t(f.hintSv, f.hintEn)}
              >
                <Text style={[st.presetName, quickFilter === f.id && st.presetNameActive]}>{t(f.sv, f.en)}</Text>
                <Text style={st.presetDesc}>{t(f.hintSv, f.hintEn)}</Text>
              </HintedTouchable>
            ))}
          </ScrollView>

          {/* Preset strategies */}
          <Text style={st.sectionTitle}>{t('STRATEGIER', 'STRATEGIES')}</Text>
          <Text style={st.sectionHelp}>{t('Färdiga sökningar som kombinerar flera villkor. De sorterar fram kandidater men är inte köpråd.', 'Preset searches that combine several conditions. They surface candidates but are not buy recommendations.')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.presetScroll}>
            {PRESET_STRATEGIES.map(p => (
              <HintedTouchable
                key={p.id}
                style={[st.presetCard, activePreset === p.id && st.presetCardActive]}
                onPress={() => applyPreset(p)}
                accessibilityLabel={`${activePreset === p.id ? t('Ta bort strategi', 'Remove strategy') : t('Aktivera strategi', 'Enable strategy')}: ${language === 'en' ? p.nameEn : p.name}`}
                hint={`${language === 'en' ? p.descriptionEn : p.description}. ${activePreset === p.id ? t('Tryck för att ta bort strategins villkor.', 'Press to remove the strategy conditions.') : t('Tryck för att använda dessa villkor.', 'Press to apply these conditions.')}`}
              >
                <Text style={st.presetIcon}>{p.icon}</Text>
                <Text style={[st.presetName, activePreset === p.id && st.presetNameActive]}>{language === 'en' ? p.nameEn : p.name}</Text>
                <Text style={st.presetDesc}>{language === 'en' ? p.descriptionEn : p.description}</Text>
              </HintedTouchable>
            ))}
          </ScrollView>

          {/* Numeric filters */}
          <Text style={st.sectionTitle}>{t('TEKNISKA FILTER', 'TECHNICAL FILTERS')}</Text>
          <Text style={st.sectionHelp}>{t('RSI beskriver styrkan i den senaste kursrörelsen. Lågt RSI kan fortsätta vara lågt i en fallande trend.', 'RSI describes the strength of the recent price move. Low RSI can remain low during a falling trend.')}</Text>
          <View style={st.filterRow}>
            <NumberInput label="RSI max" value={activeFilter.rsiMax} onChange={v => updateFilter({ rsiMax: v })} placeholder={t('t.ex. 30', 'e.g. 30')} />
            <NumberInput label="RSI min" value={activeFilter.rsiMin} onChange={v => updateFilter({ rsiMin: v })} placeholder={t('t.ex. 20', 'e.g. 20')} />
          </View>

          <Text style={st.sectionTitle}>{t('FUNDAMENTALA FILTER', 'FUNDAMENTAL FILTERS')}</Text>
          <Text style={st.sectionHelp}>{t('P/E och direktavkastning bygger på senast tillgängliga vinst- och utdelningsdata. Lågt P/E är inte automatiskt billigt.', 'P/E and dividend yield use the latest available earnings and dividend data. A low P/E is not automatically cheap.')}</Text>
          <View style={st.filterRow}>
            <NumberInput label="P/E max" value={activeFilter.peMax} onChange={v => updateFilter({ peMax: v })} placeholder={t('t.ex. 15', 'e.g. 15')} />
            <NumberInput label={t('Utdeln. min %', 'Yield min %')} value={activeFilter.divYieldMin} onChange={v => updateFilter({ divYieldMin: v })} placeholder={t('t.ex. 4', 'e.g. 4')} />
          </View>

          <Text style={st.sectionTitle}>{t('RISKFILTER', 'RISK FILTERS')}</Text>
          <Text style={st.sectionHelp}>{t('Volatilitet visar historiska svängningar och är inte ett tak för framtida risk.', 'Volatility shows historical variation and is not a ceiling for future risk.')}</Text>
          <View style={st.singleFilterRow}>
            <NumberInput label={t('Volatilitet max %', 'Volatility max %')} value={activeFilter.volatilityMax} onChange={v => updateFilter({ volatilityMax: v })} placeholder={t('t.ex. 30', 'e.g. 30')} />
          </View>

          {/* Toggle filters */}
          <Text style={st.sectionTitle}>{t('TRENDFILTER', 'TREND FILTERS')}</Text>
          <Text style={st.sectionHelp}>{t('Beskriver kursens läge mot historiska nivåer. Trendfilter är bakåtblickande och förutspår inte nästa rörelse.', 'Describes price versus historical reference levels. Trend filters are backward-looking and do not predict the next move.')}</Text>
          <View style={st.chipWrap}>
            <ToggleChip label={t('Över SMA 50', 'Above SMA 50')} hint={t('Visar bara aktier med kurs över sitt 50-dagars glidande medelvärde, en kortare trendindikator.', 'Only shows shares above their 50-session moving average, a shorter trend indicator.')} active={!!activeFilter.aboveSMA50} onToggle={() => updateFilter({ aboveSMA50: !activeFilter.aboveSMA50 })} />
            <ToggleChip label={t('Över SMA 125', 'Above SMA 125')} hint={t('Visar bara aktier med kurs över sitt 125-dagars glidande medelvärde, ungefär ett halvårssnitt.', 'Only shows shares above their 125-session moving average, roughly a six-month average.')} active={!!activeFilter.aboveSMA125} onToggle={() => updateFilter({ aboveSMA125: !activeFilter.aboveSMA125 })} />
            <ToggleChip label={t('Över SMA 200', 'Above SMA 200')} hint={t('Visar bara aktier med kurs över sitt 200-dagars glidande medelvärde, ungefär ett årssnitt.', 'Only shows shares above their 200-session moving average, roughly a one-year average.')} active={!!activeFilter.aboveSMA200} onToggle={() => updateFilter({ aboveSMA200: !activeFilter.aboveSMA200 })} />
            <ToggleChip label={t('Under SMA 125', 'Below SMA 125')} hint={t('Visar bara aktier med kurs under sitt 125-dagars glidande medelvärde.', 'Only shows shares below their 125-session moving average.')} active={!!activeFilter.belowSMA125} onToggle={() => updateFilter({ belowSMA125: !activeFilter.belowSMA125 })} />
            <ToggleChip label={t('Hög volym', 'High volume')} hint={t('Visar bara aktier där senaste volymen är minst 150 % av snittet för de senaste 20 handelsdagarna.', 'Only shows shares whose latest volume is at least 150% of their 20-session average.')} active={!!activeFilter.volAboveAvg} onToggle={() => updateFilter({ volAboveAvg: !activeFilter.volAboveAvg })} />
            <ToggleChip label={t('Nära 52v High', 'Near 52w high')} hint={t('Visar bara aktier inom 5 % från sin 52-veckorshögsta.', 'Only shows shares within 5% of their 52-week high.')} active={!!activeFilter.near52wHigh} onToggle={() => updateFilter({ near52wHigh: !activeFilter.near52wHigh })} />
            <ToggleChip label={t('Nära 52v Low', 'Near 52w low')} hint={t('Visar bara aktier inom 5 % från sin 52-veckorslägsta.', 'Only shows shares within 5% of their 52-week low.')} active={!!activeFilter.near52wLow} onToggle={() => updateFilter({ near52wLow: !activeFilter.near52wLow })} />
          </View>

          <View style={st.resultRow}>
            <Text style={st.resultText}>{filterCount > 0 ? `${matchCount} ${t('träffar av', 'matches of')} ${candidateCount}` : `${candidateCount} ${t('aktier i urvalet', 'shares in the universe')}`}</Text>
            <HintedTouchable style={st.helpButton} onPress={() => setShowHelp(true)} accessibilityLabel={t('Förklaring av Pro Filter', 'Pro Filter explanation')} hint={t('Öppnar en detaljerad förklaring av alla strategier och filter.', 'Opens a detailed explanation of all strategies and filters.')}>
              <Text style={st.helpButtonText}>ⓘ</Text>
            </HintedTouchable>
          </View>
          {filterCount > 0 && matchCount === 0 && (
            <Text style={st.noMatchesText}>{t('Alla aktiva villkor måste vara uppfyllda. Prova Sverige brett eller ta bort ett villkor.', 'Every active condition must match. Try Sweden broad or remove one condition.')}</Text>
          )}

          {activeFilterLabels.length > 0 && (
            <View style={st.activeSummary}>
              <Text style={st.activeSummaryLabel}>{t('AKTIVA VILLKOR', 'ACTIVE CONDITIONS')}</Text>
              <View style={st.activeSummaryChips}>
                {activeFilterLabels.map((label) => <View key={label} style={st.activeSummaryChip}><Text style={st.activeSummaryText}>{label}</Text></View>)}
              </View>
            </View>
          )}

          {/* Active filters summary */}
          {filterCount > 0 && (
            <View style={st.filterActions}>
              <HintedTouchable style={st.showResultsBtn} onPress={onShowResults} accessibilityLabel={`Visa ${matchCount} filterträffar`} hint="Fäller ihop Pro Filter så att aktierna som matchar villkoren syns i tabellen.">
                <Text style={st.showResultsText}>{t('Visa', 'Show')} {matchCount} {t('träffar', 'matches')}</Text>
              </HintedTouchable>
              <HintedTouchable style={st.clearBtn} onPress={clearAll} accessibilityLabel="Rensa alla Pro Filter" hint="Tar bort samtliga avancerade filter och visar hela urvalet igen.">
                <Text style={st.clearBtnText}>✕ {t('Rensa alla filter', 'Clear all filters')} ({filterCount})</Text>
              </HintedTouchable>
            </View>
          )}
        </ScrollView>
      )}

      <Modal visible={showHelp} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowHelp(false)}>
        <SafeAreaView style={st.helpSafe}>
          <View style={st.helpHeader}>
            <Text style={st.helpTitle}>Pro Filter</Text>
            <HintedTouchable style={st.helpClose} onPress={() => setShowHelp(false)} accessibilityLabel={t('Stäng förklaringen', 'Close explanation')} hint={t('Stänger förklaringen av Pro Filter.', 'Closes the Pro Filter explanation.')}>
              <Text style={st.helpCloseText}>✕</Text>
            </HintedTouchable>
          </View>
          <ScrollView contentContainerStyle={st.helpBody}>
            <Text style={st.helpIntro}>{t('Varje aktivt villkor kombineras med OCH. Saknar en aktie data för ett aktivt villkor exkluderas den, vilket gör att strikta strategier ibland kan ge noll träffar.', 'Every active condition is combined with AND. A share with missing data for an active condition is excluded, so strict strategies can return no matches.')}</Text>
            <Text style={st.helpSection}>{t('STRATEGIER', 'STRATEGIES')}</Text>
            {PRESET_STRATEGIES.map((strategy) => (
              <View key={strategy.id} style={st.helpItem}>
                <Text style={st.helpItemTitle}>{strategy.icon} {language === 'en' ? strategy.nameEn : strategy.name}</Text>
                <Text style={st.helpItemText}>{language === 'en' ? strategy.descriptionEn : strategy.description}. {t('Det är ett färdigt urval, inte ett köpråd.', 'This is a preset screen, not a buy recommendation.')}</Text>
              </View>
            ))}
            <Text style={st.helpSection}>{t('FILTER', 'FILTERS')}</Text>
            {FILTER_HELP.map(([titleSv, detailSv, titleEn, detailEn]) => (
              <View key={titleSv} style={st.helpItem}>
                <Text style={st.helpItemTitle}>{language === 'en' ? titleEn : titleSv}</Text>
                <Text style={st.helpItemText}>{language === 'en' ? detailEn : detailSv}</Text>
              </View>
            ))}
            <Text style={st.helpSection}>{t('REKYLLÄGET', 'PULLBACK GRADE')}</Text>
            <View style={st.helpItem}>
              <Text style={st.helpItemTitle}>{t('Betygssystemet förklarat', 'Grading system explained')}</Text>
              <Text style={st.helpItemText}>
                {t('Rekylläget (A till F) mäter hur tydligt en aktie fallit tillbaka. Varje aktie kan få upp till 9 poäng från sex grundkriterier och tre tekniska bonusar.', 'The pullback grade (A to F) measures how clearly a share has pulled back. A share can receive up to 9 points from six core criteria and three technical bonuses.')}
                {'\n\n'}
                {t('Fyra av de sex grundkriterierna reagerar på att kursen gått ned. Ett A betyder därför att aktien fallit mycket, inte att bolaget är bäst. Kolumnen Kvalitet bedömer i stället skuldsättning, kassaflöde och lönsamhet.', 'Four of the six core criteria react to a falling share price. An A therefore means the share has fallen substantially, not that the company is best. The Quality column instead assesses debt, cash flow and profitability.')}
              </Text>
            </View>
            <View style={st.helpItem}>
              <Text style={st.helpItemTitle}>{t('Rekylläge A', 'Pullback grade A')}</Text>
              <Text style={st.helpItemText}>{t('Kräver hög poäng samt positiv vinst och utdelning. Alternativt minst 5 uppfyllda grundkriterier med RSI under 30.', 'Requires a high score plus positive earnings and a dividend, or at least five core criteria with RSI below 30.')}</Text>
            </View>
            <View style={st.helpItem}>
              <Text style={st.helpItemTitle}>{t('Rekylläge B/C/D', 'Pullback grade B/C/D')}</Text>
              <Text style={st.helpItemText}>{t('B ges från 5 poäng, C från 3 poäng och D från 1 poäng. F betyder att inga tydliga signaler hittas.', 'B starts at 5 points, C at 3 and D at 1. F means no clear signals were found.')}</Text>
            </View>
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

  panel: { backgroundColor: C.surfaceAlt },
  panelContent: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 20 },

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
  activeSummaryText: { color: C.accent, fontSize: 11, fontWeight: '600' },
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
