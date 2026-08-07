import React from 'react';
import { Platform, TouchableOpacity, type TouchableOpacityProps } from 'react-native';

interface HintedTouchableProps extends TouchableOpacityProps {
  accessibilityLabel: string;
  hint: string;
}

/** Accessible touch target with browser-native hover text where it is available. */
export function HintedTouchable({ accessibilityLabel, hint, ...props }: HintedTouchableProps) {
  return (
    <TouchableOpacity
      {...props}
      accessibilityRole={props.accessibilityRole ?? (props.onPress ? 'button' : 'text')}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={hint}
      {...(Platform.OS === 'web' ? ({ title: hint } as Record<string, string>) : {})}
    />
  );
}
