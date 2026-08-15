import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StorefrontDemo } from "@/components/templates/storefront-demo";
import { findTemplateBySlug, getAllTemplateSlugs } from "@/lib/templates-data";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return getAllTemplateSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const found = findTemplateBySlug(slug);
  if (!found) return { title: "Démo — Be in Digital" };
  return {
    title: `Démo · ${found.template.name} — ${found.category.label}`,
    description: `Visitez la démo interactive du template ${found.template.name} : parcourez la carte, ajoutez au panier, passez commande.`,
    robots: { index: false, follow: false },
  };
}

export default async function DemoPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const found = findTemplateBySlug(slug);
  if (!found) notFound();
  return <StorefrontDemo template={found.template} category={found.category} />;
}
