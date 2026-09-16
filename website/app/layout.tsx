import type { Metadata } from "next";
import localFont from "next/font/local";
import { LanguageProvider } from "@/components/language-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const geist = localFont({
  src: "./fonts/geist-latin.woff2",
  variable: "--font-geist",
  weight: "100 900",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "AI2Dot | 企业 AI 生产力中枢",
    template: "%s | AI2Dot",
  },
  description: "统一调度全球模型、私有知识与团队工作流。AI2Dot 提供可分支、可溯源、可靠安全的企业 AI 工作台。",
  keywords: ["AI2Dot", "AI workspace", "RAG", "BYOK", "AI 工作台", "企业 AI"],
  openGraph: {
    title: "AI2Dot | 企业 AI 生产力中枢",
    description: "连接模型、知识与团队，让可靠的 AI 工作流发生在同一个点。",
    url: SITE_URL,
    siteName: "AI2Dot",
    locale: "zh_CN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI2Dot | Enterprise AI Workspace",
    description: "One workspace for models, knowledge, and reliable AI workflows.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth" className={`${geist.variable} ${geistMono.variable}`}>
      <body>
        <LanguageProvider>
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
        </LanguageProvider>
      </body>
    </html>
  );
}
