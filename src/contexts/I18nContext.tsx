import React, { createContext, useContext, useState, useCallback } from 'react';
import { translations } from '../utils/i18n';
import type { Language, TranslationKey } from '../utils/i18n';

interface I18nContextType {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: TranslationKey) => string;
  toggleLang: () => void;
}

const I18nContext = createContext<I18nContextType>(null!);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(
    () => (localStorage.getItem('zupu_lang') as Language) || 'zh'
  );

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    localStorage.setItem('zupu_lang', l);
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === 'zh' ? 'en' : 'zh');
  }, [lang, setLang]);

  const t = useCallback(
    (key: TranslationKey): string => {
      return (translations[lang] as Record<string, string>)[key] || key;
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t, toggleLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() { return useContext(I18nContext); }
