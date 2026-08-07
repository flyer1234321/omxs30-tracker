import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StockSignal } from '@/types/stock';

const toneStyles = {
  positive: { backgroundColor: 'rgba(34,197,94,0.14)', color: '#86efac' },
  attention: { backgroundColor: 'rgba(245,158,11,0.14)', color: '#fcd34d' },
  value: { backgroundColor: 'rgba(59,130,246,0.14)', color: '#93c5fd' },
};

/**
 * Utrymmet räcker till ett par märkningar per rad, så den mest
 * beslutspåverkande visas först. En kommande rapport går före en teknisk
 * signal, eftersom den kan göra signalen irrelevant.
 */
const SIGNAL_PRIORITY: Record<StockSignal['kind'], number> = {
  earningsSoon: 0,
  goldenCross: 1,
  volumeSpike: 2,
  valueDiscount: 3,
};

export function SignalBadges({ signals, limit = 2 }: { signals?: StockSignal[]; limit?: number }) {
  if (!signals?.length) return null;

  const ordered = [...signals].sort((a, b) => SIGNAL_PRIORITY[a.kind] - SIGNAL_PRIORITY[b.kind]);

  return (
    <View style={styles.row} accessibilityLabel={signals.map((signal) => signal.detail).join(', ')}>
      {ordered.slice(0, limit).map((signal) => {
        const tone = toneStyles[signal.tone];
        return (
          <View key={signal.kind} style={[styles.badge, { backgroundColor: tone.backgroundColor }]}>
            <Text style={[styles.text, { color: tone.color }]}>{signal.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3 },
  badge: { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  text: { fontSize: 9, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
