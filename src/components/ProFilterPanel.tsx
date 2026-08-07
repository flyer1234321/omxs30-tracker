import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import {
  applyProFilter,
  getActiveFilterCount,
  type ProFilter,
} from '@/lib/pro-filter';

export { applyProFilter, type ProFilter };

// Colors inline to avoid import issues during build
const C = {
  bg: '#08080f',
  surface: '#111118',
  surfaceAlt: '#16161f',
  border: '#1e1e2e',
  textPrimary: '#e2e2ea',
  textSecondary: '#6b6b82',
  textMuted: '#404055',
  accent: '#3b82f6',
  accentBg: 'rgba(59,130,246,0.10)',
  accentBorder: 'rgba(59,130,246,0.25)',
  positive: '#22c55e',
  negative: '#ef4444',
  warning: '#f59e0b',
  warningBg: 'rgba(245,158,11,0.08)',
};

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
    name: 'Deep Value',
    icon: '🔴',
    description: 'Lågt P/E + RSI < 30',
    filter: { peMax: 15, rsiMax: 30 },
  },
  {
    id: 'trend_breakout',
    name: 'Trend Breakout',
    icon: '📈',
    description: 'Över SMA50 + Nära 52v High + Hög volym',
    filter: { aboveSMA50: true, near52wHigh: true, volAboveAvg: true },
  },
  {
    id: 'dividend_discount',
    name: 'Utdelning i Rabatt',
    icon: '💰',
    description: 'Direktavkastning > 4% + RSI < 40',
    filter: { divYieldMin: 4, rsiMax: 40 },
  },
  {
    id: 'oversold_bounce',
    name: 'Översåld Studs',
    icon: '🔻',
    description: 'RSI < 25 + Under SMA125',
    filter: { rsiMax: 25, belowSMA125: true },
  },
];

interface ProFilterPanelProps {
  activeFilter: ProFilter;
  onFilterChange: (filter: ProFilter) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function NumberInput({ label, value, onChange, placeholder }: {
  label: string; value: number | undefined; onChange: (v: number | undefined) => void; placeholder: string;
}) {
  return (
    <View style={st.inputGroup}>
      <Text style={st.inputLabel}>{label}</Text>
      <TextInput
        style={st.numberInput}
        value={value != null ? String(value) : ''}
        onChangeText={t => onChange(t ? Number(t) : undefined)}
        placeholder={placeholder}
        placeholderTextColor={C.textMuted}
        keyboardType="numeric"
      />
    </View>
  );
}

function ToggleChip({ label, active, onToggle }: {
  label: string; active: boolean; onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      style={[st.toggleChip, active && st.toggleChipActive]}
      onPress={onToggle}
    >
      <Text style={[st.toggleChipText, active && st.toggleChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function ProFilterPanel({ activeFilter, onFilterChange, isExpanded, onToggleExpand }: ProFilterPanelProps) {
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const filterCount = getActiveFilterCount(activeFilter);

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
      <TouchableOpacity style={st.toggleBar} onPress={onToggleExpand}>
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
      </TouchableOpacity>

      {isExpanded && (
        <View style={st.panel}>
          {/* Preset strategies */}
          <Text style={st.sectionTitle}>STRATEGIER</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.presetScroll}>
            {PRESET_STRATEGIES.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[st.presetCard, activePreset === p.id && st.presetCardActive]}
                onPress={() => applyPreset(p)}
              >
                <Text style={st.presetIcon}>{p.icon}</Text>
                <Text style={[st.presetName, activePreset === p.id && st.presetNameActive]}>{p.name}</Text>
                <Text style={st.presetDesc}>{p.description}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Numeric filters */}
          <Text style={st.sectionTitle}>TEKNISKA FILTER</Text>
          <View style={st.filterRow}>
            <NumberInput label="RSI max" value={activeFilter.rsiMax} onChange={v => updateFilter({ rsiMax: v })} placeholder="t.ex. 30" />
            <NumberInput label="RSI min" value={activeFilter.rsiMin} onChange={v => updateFilter({ rsiMin: v })} placeholder="t.ex. 20" />
          </View>

          <Text style={st.sectionTitle}>FUNDAMENTALA FILTER</Text>
          <View style={st.filterRow}>
            <NumberInput label="P/E max" value={activeFilter.peMax} onChange={v => updateFilter({ peMax: v })} placeholder="t.ex. 15" />
            <NumberInput label="Utdeln. min %" value={activeFilter.divYieldMin} onChange={v => updateFilter({ divYieldMin: v })} placeholder="t.ex. 4" />
          </View>

          <Text style={st.sectionTitle}>RISKFILTER</Text>
          <View style={st.filterRow}>
            <NumberInput label="Volatilitet max %" value={activeFilter.volatilityMax} onChange={v => updateFilter({ volatilityMax: v })} placeholder="t.ex. 30" />
            <NumberInput label="Risk/Reward min" value={activeFilter.riskRewardMin} onChange={v => updateFilter({ riskRewardMin: v })} placeholder="t.ex. 70" />
          </View>

          {/* Toggle filters */}
          <Text style={st.sectionTitle}>TRENDFILTER</Text>
          <View style={st.chipWrap}>
            <ToggleChip label="Över SMA 50" active={!!activeFilter.aboveSMA50} onToggle={() => updateFilter({ aboveSMA50: !activeFilter.aboveSMA50 })} />
            <ToggleChip label="Över SMA 125" active={!!activeFilter.aboveSMA125} onToggle={() => updateFilter({ aboveSMA125: !activeFilter.aboveSMA125 })} />
            <ToggleChip label="Över SMA 200" active={!!activeFilter.aboveSMA200} onToggle={() => updateFilter({ aboveSMA200: !activeFilter.aboveSMA200 })} />
            <ToggleChip label="Under SMA 125" active={!!activeFilter.belowSMA125} onToggle={() => updateFilter({ belowSMA125: !activeFilter.belowSMA125 })} />
            <ToggleChip label="Hög volym" active={!!activeFilter.volAboveAvg} onToggle={() => updateFilter({ volAboveAvg: !activeFilter.volAboveAvg })} />
            <ToggleChip label="Nära 52v High" active={!!activeFilter.near52wHigh} onToggle={() => updateFilter({ near52wHigh: !activeFilter.near52wHigh })} />
            <ToggleChip label="Nära 52v Low" active={!!activeFilter.near52wLow} onToggle={() => updateFilter({ near52wLow: !activeFilter.near52wLow })} />
          </View>

          {/* Active filters summary */}
          {filterCount > 0 && (
            <TouchableOpacity style={st.clearBtn} onPress={clearAll}>
              <Text style={st.clearBtnText}>✕ Rensa alla filter ({filterCount})</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
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
    letterSpacing: 1.2, marginBottom: 8, marginTop: 12,
  },

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
});
