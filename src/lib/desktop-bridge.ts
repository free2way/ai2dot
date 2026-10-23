export type DesktopBridge = {
  getLanguage: () => Promise<"zh" | "en">;
  setLanguage: (language: "zh" | "en") => Promise<void>;
  onLanguage: (callback: (language: "zh" | "en") => void) => () => void;
  getDraft: (key: string) => Promise<string | null>;
  setDraft: (key: string, value: string | null) => Promise<void>;
};

declare global { interface Window { ai2dotDesktop?: DesktopBridge } }

export function desktopBridge() {
  return typeof window === "undefined" ? undefined : window.ai2dotDesktop;
}
