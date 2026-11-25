import { createContext, useContext, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { DSColorsDark, DSColorsLight, type DSColorSet } from '@/constants/design-system';

export type ThemeMode = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  colors: DSColorSet;
  isDark: boolean;
};

const STORAGE_KEY = 'all-sports-theme-mode';

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredMode(): ThemeMode | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' || value === 'system' ? value : null;
  } catch {
    return null;
  }
}

function persistMode(mode: ThemeMode) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Storage unavailable (native has no localStorage yet) — mode just won't
    // persist across restarts there until this is backed by AsyncStorage.
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  // Web usa output "single" (só cliente), então ler o localStorage no
  // inicializador é seguro e evita um render extra com o tema errado.
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode() ?? 'system');

  function setMode(next: ThemeMode) {
    setModeState(next);
    persistMode(next);
  }

  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');
  const colors = isDark ? DSColorsDark : DSColorsLight;

  return (
    <ThemeContext.Provider value={{ mode, setMode, colors, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}

export function useDSColors(): DSColorSet {
  return useTheme().colors;
}
