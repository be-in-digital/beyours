import type { Metadata } from "next";
import { TemplatesHero } from "@/components/templates/templates-hero";
import { TemplatesCategories } from "@/components/templates/templates-categories";
import { CtaSection } from "@/components/cta-section";

export const metadata: Metadata = {
  // The interface says "modèles"; the descriptions keep "templates", which is
  // what people actually type into a search box.
  title: "Modèles — BeYours",
  description:
    "50 templates premium (10 par univers) : pizzeria, fast-food, food truck, poulet, asiatique. Des captures réelles des sites livrés, personnalisables à vos couleurs.",
  alternates: { canonical: "/templates" },
  openGraph: {
    title: "Modèles premium — BeYours",
    description:
      "50 directions artistiques par typologie de restaurant : pizzeria, fast-food, food truck, poulet, asiatique.",
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
