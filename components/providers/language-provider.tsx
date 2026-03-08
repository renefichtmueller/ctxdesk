"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Locale, DEFAULT_LOCALE, TranslationKey, t as translate, LOCALES } from "@/lib/i18n";

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
  locales: typeof LOCALES;
}

const LanguageContext = createContext<LanguageContextType>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key) => key,
  locales: LOCALES,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("ctxdesk-locale") as Locale | null;
      if (stored && stored in LOCALES) setLocaleState(stored);
    } catch {}
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem("ctxdesk-locale", newLocale);
    } catch {}
  };

  const t = (key: TranslationKey) => translate(locale, key);

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t, locales: LOCALES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
