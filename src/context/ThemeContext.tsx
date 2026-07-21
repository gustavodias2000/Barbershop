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

export const lightTheme: Theme = {
  isDark: false,
  colors: {
    primary: '#3498db',
    secondary: '#2c3e50',
    background: '#f0f2f5',
    surface: '#ffffff',
    surfaceVariant: '#f8f9fa',
    text: '#1a2a3a',
    // #5a6472 sobre #fff → 5.87:1 (passa WCAG AA)
    textSecondary: '#5a6472',
    textMuted: '#8a9bb0',
    border: '#dde1e7',
    borderLight: '#eef0f3',
    success: '#27ae60',
    warning: '#e07b00',
    error: '#c0392b',
    info: '#2471a3',
  },
};

export const darkTheme: Theme = {
  isDark: true,
  colors: {
    primary: '#4aa3e8',
    secondary: '#ecf0f1',
    background: '#111827',
    surface: '#1f2937',
    surfaceVariant: '#374151',
    text: '#f3f4f6',
    // #a8b8c8 sobre #1f2937 → ~7.5:1 (passa WCAG AA)
    textSecondary: '#a8b8c8',
    textMuted: '#6b7280',
    border: '#374151',
    borderLight: '#4b5563',
    success: '#2ecc71',
    warning: '#f5a623',
    error: '#e74c3c',
    info: '#3498db',
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
