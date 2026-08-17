"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { SITE_EMAIL, SOCIAL_LINKS } from "@/lib/site-config";

const footerLinks = [
  {
    title: "Plateforme",
    links: [
      { label: "Fonctionnalités", href: "/fonctionnalites" },
      { label: "Modèles", href: "/templates" },
      { label: "Tarifs", href: "/tarifs" },
    ],
  },
  {
    title: "Entreprise",
    links: [
      { label: "À propos", href: "/a-propos" },
      { label: "Contact", href: "/contact" },
      { label: "Devenir apporteur", href: "/parrainage" },
    ],
  },
  {
    title: "Légal",
    links: [
      { label: "Mentions légales", href: "/mentions-legales" },
      { label: "CGV", href: "/cgv" },
      { label: "Confidentialité", href: "/confidentialite" },
    ],
  },
];

const socials = [
  {
    label: "Instagram",
    href: SOCIAL_LINKS.instagram,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="20" x="2" y="2" rx="5" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "TikTok",
    href: SOCIAL_LINKS.tiktok,
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.07 2.49 5.44 5.59 5.44 3.19 0 5.7-2.55 5.7-5.7V8.81a7.35 7.35 0 0 0 4.3 1.38V7.1s-1.88.09-3.24-1.28z" />
      </svg>
    ),
  },
  {
    label: "X",
    href: SOCIAL_LINKS.x,
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: SOCIAL_LINKS.linkedin,
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
];

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-olive text-[color:var(--primary-50)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 left-1/2 h-64 w-[42rem] -translate-x-1/2 rounded-full bg-primary/15 blur-[130px]"
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-12 py-16 lg:grid-cols-[1.5fr_1fr_1fr_1fr] lg:gap-8">
          <div className="max-w-xs">
            <Logo width={132} height={30} linked variant="light" />
            <p className="mt-5 text-sm leading-relaxed text-[color:var(--primary-100)]/70">
              La plateforme digitale des restaurateurs indépendants. Votre
              vitrine, vos commandes et vos données, réunies au même endroit.
            </p>
            <a
              href={`mailto:${SITE_EMAIL}`}
              className="mt-5 inline-block text-sm font-medium text-[color:var(--primary-200)] underline-offset-4 hover:underline"
            >
              {SITE_EMAIL}
            </a>

            <div className="mt-6 flex items-center gap-2.5">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[color:var(--primary-100)]/80 transition-colors duration-200 hover:border-primary/40 hover:bg-primary/15 hover:text-[color:var(--primary-50)]"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {footerLinks.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--primary-300)]">
                {col.title}
              </p>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-[color:var(--primary-100)]/75 transition-colors hover:text-[color:var(--primary-50)]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Giant outlined wordmark — kept to a single line */}
        <div
          aria-hidden="true"
          className="select-none whitespace-nowrap pt-2 text-center font-display font-semibold leading-none tracking-tight text-transparent"
          style={{
            fontSize: "clamp(2.2rem, 21vw, 15.4rem)",
            WebkitTextStroke: "1px rgba(238,250,247,0.16)",
          }}
        >
          BeYours
        </div>

        <div className="flex flex-col items-start justify-between gap-3 border-t border-white/10 py-6 text-xs text-[color:var(--primary-100)]/55 sm:flex-row sm:items-center">
          <p>© 2026 BeYours. Tous droits réservés.</p>
          <a
            href="#top"
            className="transition-colors hover:text-[color:var(--primary-50)]"
          >
            Retour en haut
          </a>
        </div>
      </div>
    </footer>
  );
}
