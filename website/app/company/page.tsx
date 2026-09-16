import type { Metadata } from "next";
import { CompanyContent } from "./company-content";

export const metadata: Metadata = {
  title: "关于 AI2Dot",
  description: "了解 AI2Dot 的品牌理念与工程哲学：极致专注、数学级可靠与数据主权。",
};

export default function CompanyPage() {
  return <CompanyContent />;
}
