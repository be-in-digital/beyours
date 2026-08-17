import type { Metadata } from "next";
import { HeroSection } from "@/components/hero-section";
import { ProblemSection } from "@/components/problem-section";
import { SolutionSection } from "@/components/solution-section";
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

// The canonical used to live on the root layout, where every route inherited it.
// It belongs here, on the page it actually describes.
export const metadata: Metadata = {
  alternates: {
    canonical: "/",
    languages: { "fr-FR": "/" },
  },
};

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
      <SocialProofSection />
      <TrustSection />
      <PricingPlans showHeader />
      <CtaSection />
    </>
  );
}
