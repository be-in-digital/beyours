/* ═══════════════════════════════════════════════
   /tarifs — the full pricing page
   ═══════════════════════════════════════════════ */

import type { Metadata } from "next";
import { PricingHero } from "@/components/pricing/pricing-hero";
import { PricingPlans } from "@/components/pricing/pricing-plans";
import { CommissionCalculator } from "@/components/pricing/commission-calculator";
import { PricingModel } from "@/components/pricing/pricing-model";
import { PricingComparison } from "@/components/pricing/pricing-comparison";
import { PricingMaintenance } from "@/components/pricing/pricing-maintenance";
import { PricingProcess } from "@/components/pricing/pricing-process";
import { PricingFaq } from "@/components/pricing/pricing-faq";
import { CtaSection } from "@/components/cta-section";

export const metadata: Metadata = {
  title: "Tarifs — BeYours",
  description:
    "Tarifs transparents : paiement unique pour la plateforme + maintenance annuelle claire. Aucun engagement long terme, zéro commission sur vos commandes directes.",
  alternates: { canonical: "/tarifs" },
  openGraph: {
    title: "Tarifs — BeYours",
    description:
      "Paiement one-shot + maintenance annuelle. Transparence totale, zéro commission sur vos ventes directes.",
    url: "/tarifs",
    type: "website",
  },
};

export default function TarifsPage() {
  return (
    <>
      <PricingHero />
      <PricingPlans ctaMode="checkout" />
      <CommissionCalculator />
      <PricingModel />
      <PricingComparison />
      <PricingMaintenance />
      <PricingProcess />
      <PricingFaq />
      <CtaSection />
    </>
  );
}
