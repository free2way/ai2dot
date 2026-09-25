export const APP_URL = "https://ai.ai2dot.com/";

export interface PricingTier {
  id: string;
  name: string;
  nameEn?: string;
  tagline: string;
  taglineEn?: string;
  priceMonthly: number;
  priceAnnual: number;
  popular?: boolean;
  ctaText: string;
  ctaTextEn?: string;
  ctaHref: string;
  features: string[];
  featuresEn?: string[];
  specs: {
    workspaces: string;
    models: string;
    branching: string;
    knowledgeStorage: string;
    ragLimit: string;
    byok: boolean;
    auditLog: boolean;
    support: string;
    workspacesEn?: string;
    modelsEn?: string;
    branchingEn?: string;
    knowledgeStorageEn?: string;
    ragLimitEn?: string;
    supportEn?: string;
  };
}
export interface FeatureItem {
  id: string;
  badge: string;
  badgeEn?: string;
  title: string;
  titleEn?: string;
  description: string;
  descriptionEn?: string;
  metrics: string;
  metricsEn?: string;
  iconName: "Cpu" | "GitFork" | "Database" | "ShieldCheck" | "Lock" | "Activity";
}

export interface UseCaseItem {
  role: string;
  roleEn?: string;
  company: string;
  companyEn?: string;
  quote: string;
  quoteEn?: string;
  benefit: string;
  benefitEn?: string;
}

export interface FaqItem {
  question: string;
  questionEn?: string;
  answer: string;
  answerEn?: string;
}
