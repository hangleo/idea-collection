import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const darkPalette = {
  bg: '#0A0A10',
  bgSoft: '#0E0E16',
  card: '#15151F',
  cardElevated: '#1D1D2B',
  border: '#262636',
  borderSoft: '#1F1F2E',
  text: '#F2F2F7',
  textDim: '#A0A0B8',
  textFaint: '#63637D',
  accent: '#7C5CFF',
  accentSoft: 'rgba(124, 92, 255, 0.16)',
  teal: '#2DD4BF',
  tealSoft: 'rgba(45, 212, 191, 0.14)',
  amber: '#FBBF24',
  amberSoft: 'rgba(251, 191, 36, 0.14)',
  rose: '#FB7185',
  green: '#34D399',
  danger: '#F43F5E',
  keyWhite: '#EDEDF4',
  keyBlack: '#14141C',
  keyBorder: '#B9B9C8',
  keyLabel: '#8A8AA0',
  keyWhiteActive: '#C9B8FF',
  keyBlackActive: '#3A2C6E',
  onAccent: '#FFFFFF',
} as const;

export type ThemeColors = { [K in keyof typeof darkPalette]: string };

export const lightPalette: ThemeColors = {
  bg: '#F4F4FA',
  bgSoft: '#EAEAF2',
  card: '#FFFFFF',
  cardElevated: '#FFFFFF',
  border: '#D9D9E6',
  borderSoft: '#E6E6F0',
  text: '#191922',
  textDim: '#54546A',
  textFaint: '#8E8EA6',
  accent: '#6C4CF1',
  accentSoft: 'rgba(108, 76, 241, 0.11)',
  teal: '#0E9F92',
  tealSoft: 'rgba(14, 159, 146, 0.11)',
  amber: '#C77700',
  amberSoft: 'rgba(199, 119, 0, 0.11)',
  rose: '#E11D48',
  green: '#0B9158',
  danger: '#E11D48',
  keyWhite: '#FFFFFF',
  keyBlack: '#26262F',
  keyBorder: '#D3D3DF',
  keyLabel: '#8E8EA6',
  keyWhiteActive: '#D9CCFF',
  keyBlackActive: '#B7A6F2',
  onAccent: '#FFFFFF',
};

export const themes = { dark: darkPalette, light: lightPalette };

export type ThemeMode = 'system' | 'dark' | 'light';

interface SettingsState {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themeMode: 'dark',
      setThemeMode: (themeMode) => set({ themeMode }),
    }),
    {
      name: 'idea-collection-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export function useResolvedThemeMode(): 'dark' | 'light' {
  const mode = useSettingsStore((s) => s.themeMode);
  const scheme = useColorScheme();
  if (mode === 'system') return scheme === 'light' ? 'light' : 'dark';
  return mode;
}

export function useTheme(): ThemeColors {
  const resolved = useResolvedThemeMode();
  return resolved === 'light' ? lightPalette : darkPalette;
}

export function makeNavTheme(t: ThemeColors, dark: boolean) {
  return {
    dark,
    colors: {
      primary: t.accent,
      background: t.bg,
      card: t.bg,
      text: t.text,
      border: t.border,
      notification: t.accent,
    },
    fonts: {
      regular: { fontFamily: 'System', fontWeight: '400' },
      medium: { fontFamily: 'System', fontWeight: '500' },
      bold: { fontFamily: 'System', fontWeight: '700' },
      heavy: { fontFamily: 'System', fontWeight: '800' },
    } as const,
  };
}

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  full: 999,
} as const;

export const spacing = (n: number) => n * 4;

export const DEFAULT_CATEGORIES = ['Spark', 'Work', 'Personal', 'Music', 'Someday'];

const CATEGORY_PALETTE: Record<string, string> = {
  Spark: '#F59E0B',
  Work: '#7C5CFF',
  Personal: '#14B8A6',
  Music: '#FB7185',
  Someday: '#8E8EA6',
};

const FALLBACK_COLORS = ['#7C5CFF', '#14B8A6', '#F59E0B', '#FB7185', '#6366F1', '#EC4899'];

export function categoryColor(category: string): string {
  if (CATEGORY_PALETTE[category]) return CATEGORY_PALETTE[category];
  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) | 0;
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}
