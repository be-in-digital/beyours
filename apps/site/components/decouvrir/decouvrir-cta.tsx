"use client";

import { BadgeCheck, Mail } from "lucide-react";
import { FadeIn } from "@/components/ui/motion";
import { BookingButton } from "./demo-cta-button";
import { SITE_EMAIL } from "@/lib/site-config";

export function DecouvrirCta() {
  return (
    <section className="relative px-4 py-20 sm:px-6 sm:py-28">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-olive px-6 py-14 text-center sm:px-12 sm:py-20">
        <div className="pointer-events-none absolute inset-0 bg-cta-radial opacity-70" />
        <div className="relative z-10">
          <FadeIn>
            <h2 className="mx-auto max-w-2xl font-display text-3xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--background)] sm:text-4xl">
              Transformez chaque visite en client qui revient.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[color:var(--background)]/70">
              Réservez 20 minutes. On vous montre votre futur site et votre jeu
              en conditions réelles, avec vos plats et votre marge chiffrée.
            </p>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <BookingButton>Réserver un appel</BookingButton>
              <a
                href={`mailto:${SITE_EMAIL}`}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-6 py-3.5 text-base font-medium text-[color:var(--background)] transition-colors hover:bg-white/10"
              >
                <Mail className="h-4 w-4" />
                {SITE_EMAIL}
              </a>
            </div>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[color:var(--background)]/70">
              {[
                "0 % de commission en direct",
                "Fidélité et jeu inclus",
                "1 an de maintenance incluse",
              ].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <BadgeCheck className="h-4 w-4 text-[color:var(--primary-300)]" />
                  {t}
                </span>
              ))}
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
