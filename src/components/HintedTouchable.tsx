import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type PressableProps, type TouchableOpacityProps } from 'react-native';

interface HintedTouchableProps extends TouchableOpacityProps {
  accessibilityLabel: string;
  hint: string;
}

/** A pressable control with a browser hover explanation and native accessibility hint. */
export function HintedTouchable({ accessibilityLabel, hint, ...props }: HintedTouchableProps) {
  const [showHint, setShowHint] = useState(false);
  const { activeOpacity: _activeOpacity, onFocus, onBlur, ...pressableProps } = props;
  return (
    <View style={styles.anchor} collapsable={false}>
      <Pressable
        {...(pressableProps as PressableProps)}
        accessibilityRole={props.accessibilityRole ?? (props.onPress ? 'button' : 'text')}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={hint}
        onHoverIn={() => setShowHint(true)}
        onHoverOut={() => setShowHint(false)}
        onFocus={(event) => { setShowHint(true); onFocus?.(event); }}
        onBlur={(event) => { setShowHint(false); onBlur?.(event); }}
      />
      {Platform.OS === 'web' && showHint ? <View pointerEvents="none" style={styles.tooltip}><Text style={styles.tooltipText}>{hint}</Text></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'relative', zIndex: 1 },
  tooltip: { position: 'absolute', top: '100%', left: 0, marginTop: 6, maxWidth: 330, minWidth: 190, backgroundColor: '#eaf2ff', borderColor: '#60a5fa', borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, zIndex: 1000, elevation: 12, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  tooltipText: { color: '#10213b', fontSize: 12, lineHeight: 17 },
});
