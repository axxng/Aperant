import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ColorTheme = 'default' | 'ocean' | 'forest' | 'dusk' | 'lime' | 'retro' | 'neo';

interface SettingsState {
  // Values
  theme: ThemeMode;
  colorTheme: ColorTheme;
  language: string;
  anthropicApiKey: string;
  syncInterval: number;
  defaultModel: string;

  // UI state
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveSuccess: boolean;

  // Actions
  setTheme: (theme: ThemeMode) => void;
  setColorTheme: (colorTheme: ColorTheme) => void;
  setLanguage: (language: string) => void;
  setAnthropicApiKey: (key: string) => void;
  setSyncInterval: (interval: number) => void;
  setDefaultModel: (model: string) => void;

  setIsLoading: (loading: boolean) => void;
  setIsSaving: (saving: boolean) => void;
  setError: (error: string | null) => void;
  setSaveSuccess: (success: boolean) => void;

  // Bulk load from API
  loadFromApi: (settings: Record<string, string>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  devtools(
    (set) => ({
      theme: 'system',
      colorTheme: 'default',
      language: 'en',
      anthropicApiKey: '',
      syncInterval: 60,
      defaultModel: 'sonnet',

      isLoading: false,
      isSaving: false,
      error: null,
      saveSuccess: false,

      setTheme: (theme) => set({ theme }),
      setColorTheme: (colorTheme) => set({ colorTheme }),
      setLanguage: (language) => set({ language }),
      setAnthropicApiKey: (anthropicApiKey) => set({ anthropicApiKey }),
      setSyncInterval: (syncInterval) => set({ syncInterval }),
      setDefaultModel: (defaultModel) => set({ defaultModel }),

      setIsLoading: (isLoading) => set({ isLoading }),
      setIsSaving: (isSaving) => set({ isSaving }),
      setError: (error) => set({ error }),
      setSaveSuccess: (saveSuccess) => set({ saveSuccess }),

      loadFromApi: (settings) => set({
        theme: (settings.theme as ThemeMode) || 'system',
        colorTheme: (settings.colorTheme as ColorTheme) || 'default',
        language: settings.language || 'en',
        anthropicApiKey: settings.anthropicApiKey || '',
        syncInterval: settings.syncInterval ? parseInt(settings.syncInterval, 10) : 60,
        defaultModel: settings.defaultModel || 'sonnet',
      }),
    }),
    { name: 'settings-store' }
  )
);
