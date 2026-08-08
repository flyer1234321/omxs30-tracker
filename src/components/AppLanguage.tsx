import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { appLocale, normalizeLanguage, type AppLanguage } from '@/lib/language';

const LANGUAGE_STORAGE_KEY = '@app_language';

interface AppLanguageContextValue {
  language: AppLanguage;
  locale: string;
  setLanguage: (language: AppLanguage) => void;
  toggleLanguage: () => void;
  t: (swedish: string, english: string) => string;
}

const AppLanguageContext = createContext<AppLanguageContextValue>({
  language: 'sv',
  locale: 'sv-SE',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (swedish) => swedish,
});

export function AppLanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>('sv');

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).then((stored) => {
      if (active) setLanguageState(normalizeLanguage(stored));
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  const value = useMemo<AppLanguageContextValue>(() => ({
    language,
    locale: appLocale(language),
    setLanguage: (nextLanguage) => {
      setLanguageState(nextLanguage);
      void AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    },
    toggleLanguage: () => {
      setLanguageState((current) => {
        const nextLanguage = current === 'sv' ? 'en' : 'sv';
        void AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
        return nextLanguage;
      });
    },
    t: (swedish, english) => language === 'en' ? english : swedish,
  }), [language]);

  return <AppLanguageContext.Provider value={value}>{children}</AppLanguageContext.Provider>;
}

export function useAppLanguage() {
  return useContext(AppLanguageContext);
}
