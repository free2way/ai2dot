"use client";

import { useLanguage as useWorkspaceLanguage, LanguageProvider } from "@/lib/i18n";
export type { Language } from "@/lib/i18n";
export { LanguageProvider };

// Marketing and workspace controls share one preference and provider.
export function useLanguage() {
  const { language, setLanguage } = useWorkspaceLanguage();
  return { language, setLanguage, t: (zh: string, en: string) => language === "en" ? en : zh };
}
