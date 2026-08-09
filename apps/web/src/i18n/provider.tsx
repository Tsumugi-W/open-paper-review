'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Locale } from './config';

type Messages = Record<string, string | Record<string, string>>;

interface I18nContextValue {
  locale: Locale;
  messages: Messages;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: ReactNode;
}) {
  function t(key: string): string {
    const parts = key.split('.');
    let value: unknown = messages;
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        return key;
      }
    }
    return typeof value === 'string' ? value : key;
  }

  return (
    <I18nContext.Provider value={{ locale, messages, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

export function useTranslation() {
  return useI18n().t;
}
