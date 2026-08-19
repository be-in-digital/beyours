"use client";

import Link from "next/link";
import Image from "next/image";
import { useBookingModal } from "@/lib/store";
import { FadeIn } from "@/components/ui/motion";
import { MagneticButton } from "@/components/ui/magnetic-button";

export function CtaSection() {
  const { open: openBooking } = useBookingModal();

  return (
    <section id="cta" className="relative px-4 py-20 sm:px-6 sm:py-28">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem]">
        {/* Restaurant mood photo — present, but not drowning the content */}
        <Image
          src="/photos/salle-restaurant2.webp"
          alt=""
          fill
          sizes="(max-width: 1152px) 100vw, 1152px"
          className="object-cover brightness-[1.15] saturate-[1.05]"
        />
        {/* Warm scrim for readability */}
        <div className="absolute inset-0 bg-[color:var(--olive)]/65" />
        <div className="absolute inset-0 bg-gradient-to-tr from-[color:var(--olive)]/95 via-[color:var(--olive)]/55 to-primary/30" />
        {/* Lueur terracotta */}
        <div
          aria-hidden="true"
          className="absolute -top-28 right-[-4rem] h-80 w-80 rounded-full bg-primary/30 blur-[110px]"
        />
        <div className="noise-overlay" aria-hidden="true" />

        <div className="relative z-10 mx-auto max-w-2xl px-6 py-20 text-center sm:py-24">
          <FadeIn direction="down">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              <span className="text-xs font-medium text-[color:var(--primary-100)]">
                Appel découverte gratuit · Sans engagement
              </span>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <h2 className="font-display text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-balance text-white sm:text-5xl lg:text-[3.4rem]">
              Prêt à vendre <span className="text-primary-300">sans commission</span> ?
            </h2>
          </FadeIn>

          <FadeIn delay={0.2}>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[color:var(--primary-100)]/80 sm:text-lg">
              On fait le point sur votre présence digitale, on vous montre le
              produit en direct, et on chiffre ce que la vente sans commission
              changerait pour votre restaurant.
            </p>
          </FadeIn>

          <FadeIn
            delay={0.3}
            className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4"
          >
            <MagneticButton
              onClick={() => openBooking()}
              strength={22}
              className="w-full bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-[0_18px_40px_-16px_rgba(0,0,0,0.6)] hover:brightness-105 sm:w-auto"
            >
              Réserver un appel
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M1 13L13 1M13 1H3M13 1V11" />
              </svg>
            </MagneticButton>
            <Link
              href="/templates"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-6 py-3.5 text-base font-medium text-white backdrop-blur-sm transition-colors duration-300 hover:bg-white/[0.12] sm:w-auto"
            >
              Voir des exemples de sites
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-0.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
