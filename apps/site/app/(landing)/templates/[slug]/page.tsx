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
  if (!result) return { title: "Template introuvable — BeYours" };

  return {
    title: `${result.template.name} — Template ${result.category.label} — BeYours`,
    description: result.template.tagline,
    alternates: { canonical: `/templates/${slug}` },
    openGraph: {
      title: `${result.template.name} — Template ${result.category.label}`,
      description: result.template.tagline,
      url: `/templates/${slug}`,
      type: "website",
    },
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
