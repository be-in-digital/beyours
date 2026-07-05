import type { Metadata } from "next";
import { TemplatesHero } from "@/components/templates/templates-hero";
import { TemplatesCategories } from "@/components/templates/templates-categories";
import { CtaSection } from "@/components/cta-section";

export const metadata: Metadata = {
  title: "Templates — Be in Digital",
  description:
    "Parcourez nos templates premium conçus pour chaque type de restaurant : pizzeria, fast food, asiatique, healthy, food truck. Trouvez le design idéal pour votre établissement.",
  alternates: { canonical: "/templates" },
  openGraph: {
    title: "Templates premium — Be in Digital",
    description:
      "Des templates haut de gamme par typologie de restaurant : pizzeria, asiatique, healthy, fast food, food truck.",
    url: "/templates",
    type: "website",
  },
};

export default function TemplatesPage() {
  return (
    <>
      <TemplatesHero />
      <TemplatesCategories />
      <CtaSection />
    </>
  );
}
