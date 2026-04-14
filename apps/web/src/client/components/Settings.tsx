import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Palette, Globe, Key, RefreshCw,
  Eye, EyeOff, Check, Loader2, Sun, Moon, Monitor,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { authenticatedFetch } from '../lib/api-client';
import { useSettingsStore, type ThemeMode, type ColorTheme } from '../stores/settings-store';
import { Button } from './ui/button';

const THEME_MODES: Array<{ value: ThemeMode; icon: typeof Sun }> = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Monitor },
];

const COLOR_THEMES: Array<{ value: ColorTheme; dot: string }> = [
  { value: 'default', dot: 'bg-yellow-500' },
  { value: 'ocean', dot: 'bg-blue-500' },
  { value: 'forest', dot: 'bg-green-600' },
  { value: 'dusk', dot: 'bg-orange-400' },
  { value: 'lime', dot: 'bg-lime-500' },
  { value: 'retro', dot: 'bg-amber-600' },
  { value: 'neo', dot: 'bg-pink-500' },
];

const LANGUAGES = ['en', 'fr'] as const;

export function Settings() {
  const { t } = useTranslation(['settings', 'common']);
  const store = useSettingsStore();

  const [editedFields, setEditedFields] = useState<Set<string>>(new Set());
  const [showGithubToken, setShowGithubToken] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load settings on mount
  useEffect(() => {
    let cancelled = false;

    (async () => {
      store.setIsLoading(true);
      store.setError(null);
      try {
        const response = await authenticatedFetch('/settings');
        if (response.ok) {
          const data = await response.json();
          if (!cancelled) {
            store.loadFromApi(data);
          }
        }
      } catch {
        if (!cancelled) {
          store.setError(t('settings:saveError'));
        }
      } finally {
        if (!cancelled) {
          store.setIsLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const markEdited = useCallback((field: string) => {
    setEditedFields((prev) => new Set(prev).add(field));
  }, []);

  const handleSave = useCallback(async () => {
    store.setIsSaving(true);
    store.setError(null);
    setSaveSuccess(false);

    const payload: Record<string, string> = {
      theme: store.theme,
      colorTheme: store.colorTheme,
      language: store.language,
      syncInterval: String(store.syncInterval),
    };

    // Only send API keys if user actually edited them
    if (editedFields.has('githubToken')) {
      payload.githubToken = store.githubToken;
    }

    try {
      const response = await authenticatedFetch('/settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        store.setError(t('settings:saveError'));
      } else {
        setSaveSuccess(true);
        setEditedFields(new Set());
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch {
      store.setError(t('settings:saveError'));
    } finally {
      store.setIsSaving(false);
    }
  }, [store, editedFields, t]);

  if (store.isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-3xl px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{t('settings:title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('settings:subtitle')}
            </p>
          </div>
          <SaveButton
            isSaving={store.isSaving}
            saveSuccess={saveSuccess}
            onSave={handleSave}
          />
        </div>

        {/* Error */}
        {store.error && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
            {store.error}
          </div>
        )}

        {/* Success */}
        {saveSuccess && (
          <div className="text-sm text-emerald-600 bg-emerald-500/10 rounded-lg p-3 flex items-center gap-2">
            <Check className="h-4 w-4" />
            {t('settings:saved')}
          </div>
        )}

        {/* Appearance */}
        <SettingsSection icon={Palette} title={t('settings:sections.appearance')}>
          {/* Theme Mode */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('settings:theme.label')}</label>
            <div className="flex gap-2">
              {THEME_MODES.map(({ value, icon: Icon }) => (
                <Button
                  key={value}
                  variant={store.theme === value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { store.setTheme(value); markEdited('theme'); }}
                >
                  <Icon className="h-4 w-4 mr-1.5" />
                  {t(`settings:theme.${value}`)}
                </Button>
              ))}
            </div>
          </div>

          {/* Color Theme */}
          <div className="space-y-2 mt-4">
            <label className="text-sm font-medium">{t('settings:colorTheme.label')}</label>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {COLOR_THEMES.map(({ value, dot }) => (
                <Button
                  key={value}
                  variant={store.colorTheme === value ? 'default' : 'outline'}
                  size="sm"
                  className="flex-col gap-1.5 h-auto py-2"
                  onClick={() => { store.setColorTheme(value); markEdited('colorTheme'); }}
                >
                  <span className={cn('h-3 w-3 rounded-full', dot)} />
                  <span className="text-xs">{t(`settings:colorTheme.${value}`)}</span>
                </Button>
              ))}
            </div>
          </div>
        </SettingsSection>

        {/* Language */}
        <SettingsSection icon={Globe} title={t('settings:sections.language')}>
          <div className="flex gap-2">
            {LANGUAGES.map((lang) => (
              <Button
                key={lang}
                variant={store.language === lang ? 'default' : 'outline'}
                size="sm"
                onClick={() => { store.setLanguage(lang); markEdited('language'); }}
              >
                {t(`settings:language.${lang}`)}
              </Button>
            ))}
          </div>
        </SettingsSection>

        {/* API Keys */}
        <SettingsSection icon={Key} title={t('settings:sections.apiKeys')}>
          {/* GitHub */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('settings:apiKeys.github')}</label>
            <div className="relative">
              <input
                type={showGithubToken ? 'text' : 'password'}
                value={store.githubToken}
                placeholder={t('settings:apiKeys.githubPlaceholder')}
                onChange={(e) => {
                  store.setGithubToken(e.target.value);
                  markEdited('githubToken');
                }}
                className={cn(
                  'flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 pr-10 text-sm text-foreground',
                  'placeholder:text-muted-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary',
                  'transition-colors duration-200'
                )}
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowGithubToken(!showGithubToken)}
              >
                {showGithubToken ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('settings:apiKeys.githubDescription')}
            </p>
          </div>
        </SettingsSection>

        {/* Sync & Integration */}
        <SettingsSection icon={RefreshCw} title={t('settings:sections.sync')}>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('settings:sync.interval')}</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={10}
                max={3600}
                value={store.syncInterval}
                onChange={(e) => {
                  const val = Math.max(10, Math.min(3600, parseInt(e.target.value) || 60));
                  store.setSyncInterval(val);
                  markEdited('syncInterval');
                }}
                className={cn(
                  'flex h-10 w-24 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground text-center',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary',
                  'transition-colors duration-200'
                )}
              />
              <span className="text-sm text-muted-foreground">
                {t('settings:sync.seconds')}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('settings:sync.intervalDescription')}
            </p>
          </div>
        </SettingsSection>

        {/* Bottom save button */}
        <div className="flex justify-end pt-4 border-t border-border">
          <SaveButton
            isSaving={store.isSaving}
            saveSuccess={saveSuccess}
            onSave={handleSave}
          />
        </div>
      </div>
    </div>
  );
}

/** Reusable section wrapper with icon + title */
function SettingsSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Palette;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/50 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

/** Save button with loading/success states */
function SaveButton({
  isSaving,
  saveSuccess,
  onSave,
}: {
  isSaving: boolean;
  saveSuccess: boolean;
  onSave: () => void;
}) {
  const { t } = useTranslation(['settings']);

  return (
    <Button onClick={onSave} disabled={isSaving}>
      {isSaving ? (
        <>
          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          {t('settings:actions.saving')}
        </>
      ) : saveSuccess ? (
        <>
          <Check className="h-4 w-4 mr-1.5" />
          {t('settings:saved')}
        </>
      ) : (
        t('settings:actions.save')
      )}
    </Button>
  );
}
