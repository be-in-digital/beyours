import { HeroSection } from "@/components/hero-section";
import { ProblemSection } from "@/components/problem-section";
import { SolutionSection } from "@/components/solution-section";
import { FeaturesSection } from "@/components/features-section";
import { ProductShowcase } from "@/components/product-showcase";
import { BenefitsSection } from "@/components/benefits-section";
import { TrustSection } from "@/components/trust-section";
import { SocialProofSection } from "@/components/social-proof-section";
import { PricingPlans } from "@/components/pricing/pricing-plans";
import { CtaSection } from "@/components/cta-section";
import {
  OrganizationJsonLd,
  SoftwareApplicationJsonLd,
  WebsiteJsonLd,
  FaqJsonLd,
} from "@/components/seo/json-ld";

export default function Home() {
  return (
    <>
      <OrganizationJsonLd />
      <SoftwareApplicationJsonLd />
      <WebsiteJsonLd />
      <FaqJsonLd />
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <FeaturesSection />
      <ProductShowcase />
      <BenefitsSection />
      <SocialProofSection />
      <TrustSection />
      <PricingPlans showHeader />
      <CtaSection />
    </>
  );
}
