import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { TooltipProvider } from '@/components/Tooltip';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <AuthGate>
      <ThemeProvider value={DarkTheme}>
        <TooltipProvider>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
          </Stack>
        </TooltipProvider>
      </ThemeProvider>
    </AuthGate>
  );
}
