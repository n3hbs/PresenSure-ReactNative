import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

export type AppThemeMode = 'light' | 'dark';
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
  const [mode, setStoredMode] = useState<AppThemeMode>('light');
  const [transitionColor, setTransitionColor] = useState<string | null>(null);
  const [transitionOpacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let isMounted = true;

    AsyncStorage.getItem(THEME_MODE_KEY).then(async (storedMode) => {
      if (!isMounted) return;
      if (storedMode === 'light' || storedMode === 'dark') {
        setStoredMode(storedMode);
      } else if (storedMode === 'system') {
        await AsyncStorage.setItem(THEME_MODE_KEY, 'light');
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const setMode = useCallback(async (nextMode: AppThemeMode) => {
    if (nextMode === mode) return;

    transitionOpacity.stopAnimation();
    transitionOpacity.setValue(1);
    setTransitionColor(themeTokens[mode].colors.background);
    setStoredMode(nextMode);
    const storageUpdate = AsyncStorage.setItem(THEME_MODE_KEY, nextMode);

    Animated.timing(transitionOpacity, {
      toValue: 0,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setTransitionColor(null);
      }
    });

    await storageUpdate;
  }, [mode, transitionOpacity]);

  const resolvedMode: ResolvedThemeMode = mode;

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
  }, [mode, resolvedMode, setMode]);

  return (
    <ThemeContext.Provider value={value}>
      <View style={styles.container}>
        {children}
        {transitionColor ? (
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: transitionColor,
                elevation: 999,
                opacity: transitionOpacity,
                zIndex: 999,
              },
            ]}
          />
        ) : null}
      </View>
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useAppTheme must be used inside ThemeProvider.');
  }

  return context;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
