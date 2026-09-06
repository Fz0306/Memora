import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => Promise<void>;
  systemColorScheme: 'light' | 'dark';
};

const ThemePreferenceStorageKey = 'themePreference';
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('system');
  const [systemColorScheme, setSystemColorScheme] = useState<'light' | 'dark'>(
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'
  );

  useEffect(() => {
    const loadPreference = async () => {
      try {
        const saved = await AsyncStorage.getItem(ThemePreferenceStorageKey);
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setThemeState(saved);
        }
      } catch (error) {
        console.warn('Failed to load theme preference', error);
      }
    };

    loadPreference();
  }, []);

  useEffect(() => {
    const listener = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemColorScheme(colorScheme === 'dark' ? 'dark' : 'light');
    });

    return () => {
      listener.remove();
    };
  }, []);

  const setTheme = async (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    try {
      await AsyncStorage.setItem(ThemePreferenceStorageKey, newTheme);
    } catch (error) {
      console.warn('Failed to save theme preference', error);
    }
  };

  const value = useMemo(
    () => ({ theme, setTheme, systemColorScheme }),
    [theme, systemColorScheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

export function useColorScheme() {
  const { theme } = useTheme();
  return theme;
}
