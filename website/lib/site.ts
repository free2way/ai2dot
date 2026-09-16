export const APP_URL = "https://ai.ai2dot.com/";
export const SITE_URL = "https://www.ai2note.com";

export type Language = "zh" | "en";

export type Localized<T = string> = Record<Language, T>;

export function localize<T>(language: Language, value: Localized<T>) {
  return value[language];
}
