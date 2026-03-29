import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import English translation resources
import commonEn from '../../shared/i18n/locales/en/common.json';
import navigationEn from '../../shared/i18n/locales/en/navigation.json';
import tasksEn from '../../shared/i18n/locales/en/tasks.json';
import issuesEn from '../../shared/i18n/locales/en/issues.json';
import prsEn from '../../shared/i18n/locales/en/prs.json';
import insightsEn from '../../shared/i18n/locales/en/insights.json';
import roadmapEn from '../../shared/i18n/locales/en/roadmap.json';
import ideationEn from '../../shared/i18n/locales/en/ideation.json';

// Import French translation resources
import commonFr from '../../shared/i18n/locales/fr/common.json';
import navigationFr from '../../shared/i18n/locales/fr/navigation.json';
import tasksFr from '../../shared/i18n/locales/fr/tasks.json';
import issuesFr from '../../shared/i18n/locales/fr/issues.json';
import prsFr from '../../shared/i18n/locales/fr/prs.json';
import insightsFr from '../../shared/i18n/locales/fr/insights.json';
import roadmapFr from '../../shared/i18n/locales/fr/roadmap.json';
import ideationFr from '../../shared/i18n/locales/fr/ideation.json';

export const defaultNS = 'common';

export const resources = {
  en: {
    common: commonEn,
    navigation: navigationEn,
    tasks: tasksEn,
    issues: issuesEn,
    prs: prsEn,
    insights: insightsEn,
    roadmap: roadmapEn,
    ideation: ideationEn,
  },
  fr: {
    common: commonFr,
    navigation: navigationFr,
    tasks: tasksFr,
    issues: issuesFr,
    prs: prsFr,
    insights: insightsFr,
    roadmap: roadmapFr,
    ideation: ideationFr,
  },
} as const;

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  defaultNS,
  ns: ['common', 'navigation', 'tasks', 'issues', 'prs', 'insights', 'roadmap', 'ideation'],
  interpolation: { escapeValue: false },
});

export default i18n;
