import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { normalizeThemeMode, type AppThemeMode } from '@/lib/theme-mode';

export type { AppThemeMode } from '@/lib/theme-mode';

const THEME_STORAGE_KEY = '@app_theme_mode';

interface AppThemeContextValue {
  mode: AppThemeMode;
  setMode: (mode: AppThemeMode) => void;
  toggleMode: () => void;
}

const AppThemeContext = createContext<AppThemeContextValue>({
  mode: 'dark',
  setMode: () => {},
  toggleMode: () => {},
});

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<AppThemeMode>('dark');

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(THEME_STORAGE_KEY).then((stored) => {
      if (active) setModeState(normalizeThemeMode(stored));
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.dataset.theme = mode;
      document.documentElement.style.colorScheme = mode;
    }
  }, [mode]);

  const value = useMemo<AppThemeContextValue>(() => ({
    mode,
    setMode: (nextMode) => {
      setModeState(nextMode);
      void AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode);
    },
    toggleMode: () => {
      setModeState((current) => {
        const nextMode = current === 'dark' ? 'light' : 'dark';
        void AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode);
        return nextMode;
      });
    },
  }), [mode]);

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(AppThemeContext);
}
