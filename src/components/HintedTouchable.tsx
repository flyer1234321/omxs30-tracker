import React from 'react';
import { Platform, TouchableOpacity, type TouchableOpacityProps } from 'react-native';

interface HintedTouchableProps extends TouchableOpacityProps {
  accessibilityLabel: string;
  hint: string;
}

/** A pressable control with a browser hover explanation and native accessibility hint. */
export function HintedTouchable({ accessibilityLabel, hint, ...props }: HintedTouchableProps) {
  return (
    <TouchableOpacity
      {...props}
      accessibilityRole={props.accessibilityRole ?? 'button'}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={hint}
      {...(Platform.OS === 'web' ? ({ title: hint } as Record<string, string>) : {})}
    />
  );
}
