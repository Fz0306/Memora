import 'react-native-reanimated';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { supabase } from '../constants/SupabaseConfig';
import { ThemeProvider as AppThemeProvider, useColorScheme } from '@/components/useColorScheme';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Configure deep linking
const prefix = Linking.createURL('/');
export const linking = {
  prefixes: [prefix, 'memoryarchiveapp://', 'https://hwvxfmndmdtpzvsxisgq.supabase.co'],
  config: {
    screens: {
      signin: 'signin',
      'forgot-password': 'forgot-password',
      'reset-password': ['reset-password', 'auth/v1/verify'],
      '(tabs)': '(tabs)/*',
      settings: 'settings',
      'memory/[id]': 'memory/:id',
      delete: 'delete',
    },
  },
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AppThemeProvider>
      <RootLayoutNav />
    </AppThemeProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  const pathname = usePathname();

  useEffect(() => {
    async function checkAuth() {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error('Auth session check failed:', error);
          return;
        }

        if (session?.user && (pathname === '/' || pathname === '/signin')) {
          router.replace('/(tabs)');
        }
      } catch (err) {
        console.error('Auth check error:', err);
      }
    }

    checkAuth();
  }, [router, pathname]);

  return (
    <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack initialRouteName="signin">
        <Stack.Screen name="signin" options={{ headerShown: false, animation: 'none' }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="memory/[id]" options={{ title: 'Memory Details' }} />
        <Stack.Screen name="delete" options={{ presentation: 'modal' }} />
      </Stack>
    </NavigationThemeProvider>
  );
}
