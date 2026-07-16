import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

export type AppThemeMode = 'light' | 'dark' | 'system';
export type ResolvedThemeMode = 'light' | 'dark';

const THEME_MODE_KEY = 'presensure.theme.mode';

const themeTokens = {
  light: {
    colors: {
      background: '#F8FAFC',
      surface: '#FFFFFF',
      surfaceMuted: '#E2E8F0',
      border: '#CBD5E1',
      text: '#0F172A',
      textMuted: '#64748B',
      primary: '#2563EB',
      primarySoft: '#DBEAFE',
      danger: '#DC2626',
      success: '#16A34A',
    },
    statusBarStyle: 'dark' as const,
  },
  dark: {
    colors: {
      background: '#020617',
      surface: '#0F172A',
      surfaceMuted: '#1E293B',
      border: '#334155',
      text: '#F8FAFC',
      textMuted: '#94A3B8',
      primary: '#60A5FA',
      primarySoft: '#1E3A8A',
      danger: '#F87171',
      success: '#4ADE80',
    },
    statusBarStyle: 'light' as const,
  },
};

const spacing = {
  screen: 24,
  component: 24,
  compact: 12,
};

const radii = {
  card: 12,
  panel: 12,
  button: 8,
  input: 8,
};

type ThemeContextValue = {
  mode: AppThemeMode;
  resolvedMode: ResolvedThemeMode;
  setMode: (mode: AppThemeMode) => Promise<void>;
  colors: (typeof themeTokens)[ResolvedThemeMode]['colors'];
  spacing: typeof spacing;
  radii: typeof radii;
  statusBarStyle: (typeof themeTokens)[ResolvedThemeMode]['statusBarStyle'];
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setStoredMode] = useState<AppThemeMode>('system');

  useEffect(() => {
    let isMounted = true;

    AsyncStorage.getItem(THEME_MODE_KEY).then((storedMode) => {
      if (!isMounted) return;
      if (storedMode === 'light' || storedMode === 'dark' || storedMode === 'system') {
        setStoredMode(storedMode);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const setMode = async (nextMode: AppThemeMode) => {
    setStoredMode(nextMode);
    await AsyncStorage.setItem(THEME_MODE_KEY, nextMode);
  };

  const resolvedMode: ResolvedThemeMode =
    mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  const value = useMemo<ThemeContextValue>(() => {
    const theme = themeTokens[resolvedMode];

    return {
      mode,
      resolvedMode,
      setMode,
      colors: theme.colors,
      spacing,
      radii,
      statusBarStyle: theme.statusBarStyle,
    };
  }, [mode, resolvedMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useAppTheme must be used inside ThemeProvider.');
  }

  return context;
}
