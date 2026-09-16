"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { Language, Localized } from "@/lib/site";
import { localize } from "@/lib/site";

const STORAGE_KEY = "ai2dot.marketing.language.v1";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  text: <T>(value: Localized<T>) => T;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("zh");
  const pathname = usePathname();

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage?.getItem(STORAGE_KEY) ?? null;
    } catch {
      saved = null;
    }
    const preferred = window.navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
    const timer = window.setTimeout(() => {
      const selected = saved === "zh" || saved === "en" ? saved : preferred;
      setLanguageState(selected);
      document.documentElement.lang = selected === "zh" ? "zh-CN" : "en";
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    document.documentElement.lang = nextLanguage === "zh" ? "zh-CN" : "en";
    try {
      window.localStorage?.setItem(STORAGE_KEY, nextLanguage);
    } catch {
      // Language switching still works when storage is blocked by the browser.
    }
  }, []);

  useEffect(() => {
    const routeTitles: Record<string, Localized> = {
      "/": { zh: "AI2Dot | 企业 AI 生产力中枢", en: "AI2Dot | Enterprise AI Workspace" },
      "/product": { zh: "产品与架构 | AI2Dot", en: "Product and Architecture | AI2Dot" },
      "/pricing": { zh: "定价 | AI2Dot", en: "Pricing | AI2Dot" },
      "/company": { zh: "关于 AI2Dot | AI2Dot", en: "Company | AI2Dot" },
      "/contact": { zh: "商务咨询 | AI2Dot", en: "Enterprise Contact | AI2Dot" },
    };
    // App Router may stream route metadata shortly after hydration. Apply the
    // localized title once that initial head update has settled.
    const timer = window.setTimeout(() => {
      document.title = localize(language, routeTitles[pathname] ?? routeTitles["/"]);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [language, pathname]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      text: <T,>(content: Localized<T>) => localize(language, content),
    }),
    [language, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used inside LanguageProvider");
  return value;
}
