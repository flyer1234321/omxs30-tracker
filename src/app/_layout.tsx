import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppThemeProvider, useAppTheme } from '@/components/AppTheme';
import { AuthGate } from '@/components/AuthGate';
import { TooltipProvider } from '@/components/Tooltip';
import './global.css';

SplashScreen.preventAutoHideAsync();

function ThemedApplication() {
  const { mode } = useAppTheme();

  return (
    <ThemeProvider value={mode === 'light' ? DefaultTheme : DarkTheme}>
      <AuthGate>
        <TooltipProvider>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
          </Stack>
        </TooltipProvider>
      </AuthGate>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <AppThemeProvider>
      <ThemedApplication />
    </AppThemeProvider>
  );
}
