"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import type { NavItem } from "@/sanity/types";

/**
 * MobileNav — bouton hamburger + overlay fullscreen avec les liens.
 *
 * Visible uniquement sur < md. Ferme sur ESC, sur changement de route, et
 * lock le scroll du body quand ouvert. Animation Framer cinematique
 * (slide-up + fade), liens cascadés.
 *
 * Les nav items sont fournis par le Navbar server component qui les fetch
 * dans Sanity.
 */
type Props = {
  navItems: NavItem[];
  ctaLabel: string;
  ctaHref: string;
};

export function MobileNav({ navItems, ctaLabel, ctaHref }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Fermer le menu quand la route change. setState dans un effect ici
    // est volontaire — c'est la sémantique du "close on navigate".
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="bid-mobile-menu"
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        onClick={() => setOpen((v) => !v)}
        className="text-foreground hover:text-primary relative z-50 inline-flex size-10 items-center justify-center rounded-full transition-colors md:hidden"
      >
        <span className="relative block size-5">
          <span
            aria-hidden
            className={`bg-current absolute left-0 block h-px w-5 transition-all duration-300 ${
              open ? "top-1/2 rotate-45" : "top-1"
            }`}
          />
          <span
            aria-hidden
            className={`bg-current absolute left-0 block h-px w-5 transition-all duration-300 ${
              open ? "top-1/2 -rotate-45" : "top-3.5"
            }`}
          />
        </span>
      </button>

      {open ? (
        <div
          id="bid-mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu principal"
          className="fixed inset-0 z-40 isolate md:hidden"
          style={{ backgroundColor: "#090909" }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(82,207,175,0.15), transparent 60%)",
            }}
          />
          <nav
            aria-label="Navigation mobile"
            className="relative flex h-svh flex-col justify-between px-6 pt-28 pb-12"
            style={{ backgroundColor: "#090909" }}
          >
            <ul className="space-y-7">
              {navItems.map((link, i) => (
                <li
                  key={link.href}
                  className="bid-mnav-item"
                  style={{ animationDelay: `${100 + i * 70}ms` }}
                >
                  <Link
                    href={link.href}
                    className="font-display text-foreground hover:text-primary block text-5xl leading-none font-light tracking-tight transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div
              className="bid-mnav-cta flex flex-col gap-6"
              style={{ animationDelay: "450ms" }}
            >
              <Link
                href={ctaHref}
                className="bg-primary text-primary-foreground glow-primary inline-flex items-center justify-center rounded-full px-7 py-3.5 text-sm font-medium tracking-wide"
              >
                {ctaLabel}
              </Link>
              <p className="text-muted-foreground/80 font-mono text-[10px] tracking-[0.2em] uppercase">
                hello@beindigital.fr · Paris
              </p>
            </div>
          </nav>
          <style>{`
            .bid-mnav-item {
              opacity: 0;
              transform: translateY(24px);
              animation: bid-mnav-fade 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            .bid-mnav-cta {
              opacity: 0;
              transform: translateY(16px);
              animation: bid-mnav-fade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            @keyframes bid-mnav-fade {
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            @media (prefers-reduced-motion: reduce) {
              .bid-mnav-item,
              .bid-mnav-cta {
                animation: none;
                opacity: 1;
                transform: none;
              }
            }
          `}</style>
        </div>
      ) : null}
    </>
  );
}
