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

const LANG_KEY = 'homesome_lang';
const LEGACY_LANG_KEY = 'zupu_lang';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(
    () => {
      const legacy = localStorage.getItem(LEGACY_LANG_KEY) as Language | null;
      const current = localStorage.getItem(LANG_KEY) as Language | null;
      const next = current || legacy || 'zh';
      localStorage.setItem(LANG_KEY, next);
      return next;
    }
  );

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    localStorage.setItem(LANG_KEY, l);
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
