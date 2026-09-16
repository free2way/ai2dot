import type { Metadata } from "next";
import { ContactContent } from "./contact-content";

export const metadata: Metadata = {
  title: "商务咨询",
  description: "联系 AI2Dot，咨询 Team 采购、企业私有化部署、SSO 与专属模型网关。",
};

export default function ContactPage() {
  return <ContactContent />;
}
