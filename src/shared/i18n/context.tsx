import React, { createContext, useContext, useState, useEffect } from 'react';
import fr from './fr.json';
import ar from './ar.json';

export type Locale = 'fr' | 'ar';

export type I18nCatalog = typeof fr;

interface I18nContextType {
  locale: Locale;
  setLocale: (loc: Locale) => void;
  dir: 'ltr' | 'rtl';
  t: (path: string, fallback?: string) => string;
  strings: I18nCatalog;
}

const catalogs: Record<Locale, I18nCatalog> = {
  fr,
  ar,
};

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem('mizan_locale');
    return saved === 'ar' ? 'ar' : 'fr';
  });

  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  const setLocale = (newLoc: Locale) => {
    setLocaleState(newLoc);
    localStorage.setItem('mizan_locale', newLoc);
  };

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  const t = (path: string, fallback?: string): string => {
    const parts = path.split('.');
    let cur: any = catalogs[locale];
    for (const p of parts) {
      if (cur && typeof cur === 'object' && p in cur) {
        cur = cur[p];
      } else {
        return fallback || path;
      }
    }
    return typeof cur === 'string' ? cur : fallback || path;
  };

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        dir,
        t,
        strings: catalogs[locale],
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}
