import type { Metadata } from "next";

import { ContactForm } from "@/components/contact-form";
import { sanityFetch } from "@/sanity/lib/fetch";
import { contactPageQuery } from "@/sanity/lib/queries";
import type { ContactPage } from "@/sanity/types";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Discutons de votre projet digital. Be in Digital répond à toutes les demandes sous 24 h. Studio digital indépendant à Paris.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const page = await sanityFetch<ContactPage>({ query: contactPageQuery });

  return (
    <main className="bg-background relative min-h-svh overflow-hidden">
      <section className="relative px-6 pt-32 pb-24 sm:px-10 sm:pt-40 sm:pb-32">
        <div className="bg-section-radial pointer-events-none absolute inset-0" />
        <div className="relative mx-auto grid max-w-6xl gap-16 lg:grid-cols-12">
          {/* Hero copy */}
          <div className="lg:col-span-5">
            <p className="font-mono text-primary mb-4 text-xs tracking-[0.2em] uppercase">
              {page.hero.eyebrow}
            </p>
            <h1 className="font-display text-foreground text-5xl leading-[0.95] font-light tracking-tight sm:text-6xl lg:text-[5rem]">
              {page.hero.titleLine1}
              <br />
              <span className="text-primary italic">{page.hero.titleLine2}</span>
            </h1>
            <p className="text-muted-foreground mt-8 text-lg leading-relaxed sm:text-xl">
              {page.hero.intro}
            </p>

            <dl className="mt-12 space-y-6">
              {page.sidebar.channels.map((channel) => (
                <div key={channel.label}>
                  <dt className="font-mono text-muted-foreground text-xs tracking-[0.2em] uppercase">
                    {channel.label}
                  </dt>
                  <dd className="mt-2">
                    <a
                      href={channel.href}
                      target={
                        channel.href.startsWith("http") ? "_blank" : undefined
                      }
                      rel={
                        channel.href.startsWith("http")
                          ? "noopener noreferrer"
                          : undefined
                      }
                      className="font-display text-foreground hover:text-primary text-2xl font-light transition-colors"
                      data-magnetic
                    >
                      {channel.value}
                    </a>
                  </dd>
                </div>
              ))}
              <div>
                <dt className="font-mono text-muted-foreground text-xs tracking-[0.2em] uppercase">
                  {page.sidebar.locationTitle}
                </dt>
                <dd className="text-foreground mt-2 text-base leading-relaxed">
                  {page.sidebar.locationValue}
                </dd>
              </div>
            </dl>
          </div>

          {/* Form */}
          <div className="lg:col-span-7">
            <div className="bg-surface-1 border-border/60 rounded-2xl border p-8 sm:p-10">
              <h2 className="font-display text-foreground mb-8 text-2xl font-light sm:text-3xl">
                {page.form.title}
              </h2>
              <ContactForm
                submitLabel={page.form.submitLabel}
                successMessage={page.form.successMessage}
              />
            </div>
            <p className="text-muted-foreground mt-6 text-xs leading-relaxed">
              Vos informations restent confidentielles. Conservation 3 ans, droit
              d’accès et de suppression sur simple demande à hello@beindigital.fr
              (RGPD).
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
