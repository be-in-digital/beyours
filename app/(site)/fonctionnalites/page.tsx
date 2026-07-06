import type { Metadata } from "next";
import { CtaSection } from "@/components/cta-section";
import { FeaturesHero } from "@/components/features/features-hero";
import { FeaturesBentoOverview } from "@/components/features/features-bento-overview";
import { FeatureDeepDives } from "@/components/features/feature-deep-dive";
import { FeaturesCompactBlock } from "@/components/features/features-compact-block";
import { FeaturesNav } from "@/components/features/features-nav";
import { EcosystemRecap } from "@/components/features/ecosystem-recap";

export const metadata: Metadata = {
  title: "Fonctionnalités — Be in Digital",
  description:
    "Découvrez les 10 fonctionnalités de la plateforme Be in Digital : site web premium, commande en ligne, fidélisation, analytics et plus encore.",
  alternates: { canonical: "/fonctionnalites" },
  openGraph: {
    title: "Fonctionnalités — Be in Digital",
    description:
      "10 fonctionnalités pensées pour les restaurants : site, commande, fidélité, analytics, Uber Eats & Deliveroo centralisés.",
    url: "/fonctionnalites",
    type: "website",
  },
};

export default function FonctionnalitesPage() {
  return (
    <>
      <FeaturesHero />
      <div id="features-bento">
        <FeaturesBentoOverview />
      </div>
      <FeaturesNav />
      <FeatureDeepDives />
      <div id="et-aussi">
        <FeaturesCompactBlock />
      </div>
      <EcosystemRecap />
      <CtaSection />
    </>
  );
}
