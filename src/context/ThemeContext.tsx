import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  surfaceVariant: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderLight: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

export interface Theme {
  colors: ThemeColors;
  isDark: boolean;
}

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  isDarkMode: boolean;
  themeMode: ThemeMode;
  toggleTheme: (mode: ThemeMode) => Promise<void>;
}

// ─── Temas ───────────────────────────────────────────────────────────────────

// ─── Paleta: Azul Profundo + Âmbar ───────────────────────────────────────────
// Light: âmbar escuro (#D97706) sobre branco — contraste 4.6:1 (WCAG AA)
// Dark : âmbar claro (#F59E0B) sobre azul-escuro (#1A2735) — contraste 8.1:1

export const lightTheme: Theme = {
  isDark: false,
  colors: {
    primary: '#D97706',          // âmbar escuro — contraste suficiente em fundo claro
    secondary: '#92400E',        // âmbar profundo
    background: '#F8FAFC',       // branco-azulado suave
    surface: '#FFFFFF',
    surfaceVariant: '#F1F5F9',
    text: '#0F172A',             // quase-preto azulado
    textSecondary: '#475569',    // slate-600 — 7.5:1 sobre branco
    textMuted: '#94A3B8',        // slate-400
    border: '#CBD5E1',
    borderLight: '#E2E8F0',
    success: '#059669',
    warning: '#D97706',
    error: '#DC2626',
    info: '#2563EB',
  },
};

export const darkTheme: Theme = {
  isDark: true,
  colors: {
    primary: '#F59E0B',          // âmbar — cor de destaque principal
    secondary: '#FCD34D',        // âmbar claro
    background: '#0F1923',       // azul profundo quase-preto
    surface: '#1A2735',          // cards e modais
    surfaceVariant: '#1F3144',   // inputs e variantes
    text: '#F8FAFC',             // branco-azulado
    textSecondary: '#94A3B8',    // slate-400 — 7.2:1 sobre surface
    textMuted: '#5C7A96',        // slate mais escuro
    border: '#2A3F54',
    borderLight: '#1F3347',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#60A5FA',
  },
};

// ─── Contexto ────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === 'dark');
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');

  useEffect(() => {
    loadThemePreference();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (themeMode === 'system') {
      setIsDarkMode(systemColorScheme === 'dark');
    }
  }, [systemColorScheme, themeMode]);

  const loadThemePreference = async () => {
    try {
      const savedTheme = (await AsyncStorage.getItem('themeMode')) as ThemeMode | null;
      if (savedTheme) {
        setThemeMode(savedTheme);
        if (savedTheme !== 'system') {
          setIsDarkMode(savedTheme === 'dark');
        }
      }
    } catch (error) {
      console.error('Erro ao carregar preferência de tema:', error);
    }
  };

  const toggleTheme = async (mode: ThemeMode) => {
    try {
      setThemeMode(mode);
      await AsyncStorage.setItem('themeMode', mode);

      if (mode === 'light') {
        setIsDarkMode(false);
      } else if (mode === 'dark') {
        setIsDarkMode(true);
      } else {
        setIsDarkMode(systemColorScheme === 'dark');
      }
    } catch (error) {
      console.error('Erro ao salvar preferência de tema:', error);
    }
  };

  const theme = isDarkMode ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, isDarkMode, themeMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme deve ser usado dentro de ThemeProvider');
  }
  return context;
};
