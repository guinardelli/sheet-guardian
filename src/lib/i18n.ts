import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ptTranslations from '@/lib/locales/pt.json';
import enTranslations from '@/lib/locales/en.json';

const savedLanguage = localStorage.getItem('language') || 'pt';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      pt: { translation: ptTranslations },
      en: { translation: enTranslations },
    },
    lng: savedLanguage,
    fallbackLng: 'pt',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;

