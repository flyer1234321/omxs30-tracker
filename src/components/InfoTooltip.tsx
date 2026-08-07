import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface InfoTooltipProps {
  label: string;
  description: string;
  align?: 'left' | 'right';
}

/** Small, deliberate explanatory popover used beside headings and metrics. */
export function InfoTooltip({ label, description, align = 'left' }: InfoTooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.anchor, visible && styles.anchorRaised]}>
      <Pressable
        style={[styles.trigger, visible && styles.triggerActive]}
        onPress={() => setVisible((value) => !value)}
        onHoverIn={() => setVisible(true)}
        onHoverOut={() => setVisible(false)}
        accessibilityRole="button"
        accessibilityLabel={`Förklaring: ${label}`}
        accessibilityHint={description}
      >
        <Text style={styles.triggerText}>i</Text>
      </Pressable>
      {visible ? (
        <View pointerEvents="none" style={[styles.popover, align === 'right' ? styles.popoverRight : styles.popoverLeft]}>
          <Text style={styles.title}>{label}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'relative', zIndex: 1 },
  anchorRaised: { zIndex: 30 },
  trigger: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#44516a',
    backgroundColor: '#1a2231',
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerActive: { borderColor: '#60a5fa', backgroundColor: '#223a5e' },
  triggerText: { color: '#bfdbfe', fontSize: 10, fontWeight: '800', lineHeight: 13 },
  popover: {
    position: 'absolute',
    top: 24,
    width: 248,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#161d29',
    shadowColor: '#000',
    shadowOpacity: 0.32,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  popoverLeft: { left: 0 },
  popoverRight: { right: 0 },
  title: { color: '#dbeafe', fontSize: 12, fontWeight: '800', marginBottom: 4 },
  description: { color: '#b8c1d1', fontSize: 12, lineHeight: 17 },
});
