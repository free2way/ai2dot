import type { Metadata } from "next";
import { ProductContent } from "./product-content";

export const metadata: Metadata = {
  title: "产品与架构",
  description: "深入了解 AI2Dot 的多模型调度、非覆盖式分支、混合检索 RAG、幂等生成与凭证安全架构。",
};

export default function ProductPage() {
  return <ProductContent />;
}
