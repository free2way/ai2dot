import type { Metadata } from "next";
import { PricingContent } from "./pricing-content";

export const metadata: Metadata = {
  title: "定价",
  description: "从免费体验到企业私有部署，选择适合个人、团队与大型组织的 AI2Dot 方案。",
};

export default function PricingPage() {
  return <PricingContent />;
}
