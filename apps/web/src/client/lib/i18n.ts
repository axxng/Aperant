import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import English translation resources
import commonEn from '../../shared/i18n/locales/en/common.json';
import navigationEn from '../../shared/i18n/locales/en/navigation.json';
import tasksEn from '../../shared/i18n/locales/en/tasks.json';
import settingsEn from '../../shared/i18n/locales/en/settings.json';
import authEn from '../../shared/i18n/locales/en/auth.json';

// Import French translation resources
import commonFr from '../../shared/i18n/locales/fr/common.json';
import navigationFr from '../../shared/i18n/locales/fr/navigation.json';
import tasksFr from '../../shared/i18n/locales/fr/tasks.json';
import settingsFr from '../../shared/i18n/locales/fr/settings.json';
import authFr from '../../shared/i18n/locales/fr/auth.json';

export const defaultNS = 'common';

export const resources = {
  en: {
    common: commonEn,
    navigation: navigationEn,
    tasks: tasksEn,
    settings: settingsEn,
    auth: authEn,
  },
  fr: {
    common: commonFr,
    navigation: navigationFr,
    tasks: tasksFr,
    settings: settingsFr,
    auth: authFr,
  },
} as const;

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  defaultNS,
  ns: ['common', 'navigation', 'tasks', 'settings', 'auth'],
  interpolation: { escapeValue: false },
});

export default i18n;
