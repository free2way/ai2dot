"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "@phosphor-icons/react";
import { useLanguage } from "@/components/language-provider";
import { APP_URL } from "@/lib/site";

export function FinalCta() {
  const { text } = useLanguage();

  return (
    <section className="final-cta section-shell">
      <div>
        <h2>{text({ zh: "让每一次生成，都成为可复用的生产力。", en: "Turn every generation into reusable work." })}</h2>
      </div>
      <div className="cta-actions">
        <a className="button button-acid" href={APP_URL} target="_blank" rel="noreferrer">
          {text({ zh: "立即体验", en: "Start now" })}
          <ArrowUpRight size={17} weight="bold" />
        </a>
        <Link className="text-link" href="/contact">
          {text({ zh: "咨询企业方案", en: "Talk to enterprise" })}
          <ArrowRight size={16} weight="bold" />
        </Link>
      </div>
    </section>
  );
}
