import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findTemplateBySlug, getAllTemplateSlugs } from "@/lib/templates-data";
import { TemplatePreview } from "@/components/templates/template-preview";
import { CtaSection } from "@/components/cta-section";

export async function generateStaticParams() {
  return getAllTemplateSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = findTemplateBySlug(slug);
  if (!result) return { title: "Template introuvable — Be in Digital" };

  return {
    title: `${result.template.name} — Template ${result.category.label} — Be in Digital`,
    description: result.template.description,
  };
}

export default async function TemplatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = findTemplateBySlug(slug);
  if (!result) notFound();

  return (
    <>
      <div className="pt-20" />
      <TemplatePreview template={result.template} category={result.category} />
      <CtaSection />
    </>
  );
}
