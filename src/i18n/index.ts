import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import es from './locales/es.json';

// Textos de la interfaz. El contenido del temario se traduce aparte (public/content/<idioma>/).
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { es: { translation: es }, en: { translation: en } },
    fallbackLng: 'es',
    supportedLngs: ['es', 'en'],
    nonExplicitSupportedLngs: true,   // "es-PE" → "es", "en-US" → "en"
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] }
  });

i18n.on('languageChanged', idioma => { document.documentElement.lang = idioma; });

export default i18n;
