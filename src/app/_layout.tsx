import { Stack, ThemeProvider, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { useNotificationResponse } from '@/lib/notifications';
import { makeNavTheme, useResolvedThemeMode, useTheme } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function useNotificationRedirect() {
  const response = useNotificationResponse();
  useEffect(() => {
    const url = response?.notification?.request?.content?.data?.url;
    if (response && typeof url === 'string') {
      router.push(url as never);
    }
  }, [response]);
}

export default function RootLayout() {
  useNotificationRedirect();

  const t = useTheme();
  const resolved = useResolvedThemeMode();
  const navTheme = useMemo(() => makeNavTheme(t, resolved === 'dark'), [t, resolved]);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={resolved === 'light' ? 'dark' : 'light'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: t.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="idea/[id]" options={{ presentation: 'card', animation: 'slide_from_right' }} />
      </Stack>
    </ThemeProvider>
  );
}
