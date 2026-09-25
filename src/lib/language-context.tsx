"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Language = "zh" | "en";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (zhText: string, enText: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "zh",
  setLanguage: () => {},
  t: (zhText) => zhText,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("zh");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = localStorage.getItem("ai2dot_lang") as Language | null;
      if (saved === "zh" || saved === "en") {
        setLanguageState(saved);
      } else {
        const browserLang = navigator.language.toLowerCase();
        if (browserLang.startsWith("en")) {
          setLanguageState("en");
        }
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("ai2dot_lang", lang);
    } catch {}
  };

  const t = (zhText: string, enText: string) => {
    return language === "en" ? enText : zhText;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
