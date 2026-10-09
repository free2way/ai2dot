import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppProviders } from "@/components/app-providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ai2dot | 企业级与专业团队的下一代 AI 聚合工作台",
  description: "统一接入主流顶尖大模型，具备非覆盖式会话分支、混合检索知识库 RAG、工业级幂等生成与企业硬件级加密，打造安静可靠的企业 AI 智能中枢。",
  keywords: [
    "ai2dot",
    "AI聚合工作台",
    "多模型管理",
    "企业知识库RAG",
    "生成幂等引擎",
    "会话分支",
    "AI工作台",
    "BYOK",
  ],
  authors: [{ name: "ai2dot Team" }],
  openGraph: {
    title: "ai2dot — 专为现代企业打造的 AI 智能聚合工作台",
    description: "打破单一模型壁垒，统一调度全球顶尖大模型。工业级可靠、安全可控、无缝协作。",
    url: "https://ai2dot.com",
    siteName: "ai2dot",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} min-h-full antialiased`}
    >
      <body className="min-h-full selection:bg-[#b7f34a]/30 selection:text-white">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
