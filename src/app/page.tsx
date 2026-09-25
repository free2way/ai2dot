import { MarketingNavbar } from "@/components/marketing/navbar";
import { MarketingHero } from "@/components/marketing/hero";
import { InteractiveWorkspacePreview } from "@/components/marketing/interactive-preview";
import { FeaturesSection } from "@/components/marketing/features-section";
import { ArchitectureSection } from "@/components/marketing/architecture-section";
import { PricingSection } from "@/components/marketing/pricing-section";
import { UseCasesSection } from "@/components/marketing/use-cases-section";
import { FaqSection } from "@/components/marketing/faq-section";
import { MarketingCtaSection } from "@/components/marketing/cta-section";
import { MarketingFooter } from "@/components/marketing/footer";

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-[#07090c] text-zinc-100 selection:bg-[#b7f34a]/30 selection:text-white">
      {/* Dynamic Background Noise/Grid */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px] opacity-60" />

      {/* Global Navigation */}
      <MarketingNavbar />

      {/* Main Marketing Flow */}
      <main className="relative">
        <MarketingHero />
        <InteractiveWorkspacePreview />
        <FeaturesSection />
        <ArchitectureSection />
        <PricingSection />
        <UseCasesSection />
        <FaqSection />
        <MarketingCtaSection />
      </main>

      {/* Enterprise Footer */}
      <MarketingFooter />
    </div>
  );
}
