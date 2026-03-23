import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import commonEn from '../../shared/i18n/locales/en/common.json';
import navigationEn from '../../shared/i18n/locales/en/navigation.json';
import tasksEn from '../../shared/i18n/locales/en/tasks.json';

i18n.use(initReactI18next).init({
  resources: {
    en: {
      common: commonEn,
      navigation: navigationEn,
      tasks: tasksEn,
    },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  defaultNS: 'common',
});

export default i18n;
