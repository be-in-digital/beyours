/* ═══════════════════════════════════════════════
   /tarifs — Page tarifs complète
   ═══════════════════════════════════════════════ */

import type { Metadata } from "next";
import { PricingHero } from "@/components/pricing/pricing-hero";
import { PricingPlans } from "@/components/pricing/pricing-plans";
import { PricingModel } from "@/components/pricing/pricing-model";
import { PricingComparison } from "@/components/pricing/pricing-comparison";
import { PricingMaintenance } from "@/components/pricing/pricing-maintenance";
import { PricingProcess } from "@/components/pricing/pricing-process";
import { PricingFaq } from "@/components/pricing/pricing-faq";
import { CtaSection } from "@/components/cta-section";

export const metadata: Metadata = {
  title: "Tarifs — Be in Digital",
  description:
    "Tarifs transparents : paiement unique pour la plateforme + maintenance annuelle claire. Aucun engagement long terme, zéro commission sur vos commandes directes.",
  alternates: { canonical: "/tarifs" },
  openGraph: {
    title: "Tarifs — Be in Digital",
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
      <PricingPlans />
      <PricingModel />
      <PricingComparison />
      <PricingMaintenance />
      <PricingProcess />
      <PricingFaq />
      <CtaSection />
    </>
  );
}
