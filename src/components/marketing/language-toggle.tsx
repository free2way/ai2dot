"use client";

import { useState, useRef, useEffect } from "react";
import { Globe, Check } from "lucide-react";
import { useLanguage, Language } from "@/lib/language-context";

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const options: { code: Language; label: string; flag: string }[] = [
    { code: "zh", label: "中文", flag: "🇨🇳" },
    { code: "en", label: "English", flag: "🇺🇸" },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:border-[#b7f34a]/40 hover:bg-white/[0.08] hover:text-white transition-all"
        aria-label="Toggle language"
      >
        <Globe className="h-3.5 w-3.5 text-[#b7f34a]" />
        <span>{language === "zh" ? "中文" : "EN"}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-32 rounded-xl border border-white/10 bg-[#0d1016]/95 backdrop-blur-xl p-1 shadow-2xl shadow-black/80 z-50 animate-in fade-in zoom-in-95 duration-150">
          {options.map((opt) => (
            <button
              key={opt.code}
              type="button"
              onClick={() => {
                setLanguage(opt.code);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                language === opt.code
                  ? "bg-[#b7f34a]/15 text-[#b7f34a]"
                  : "text-zinc-300 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <span className="flex items-center gap-2">
                <span>{opt.flag}</span>
                <span>{opt.label}</span>
              </span>
              {language === opt.code && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
