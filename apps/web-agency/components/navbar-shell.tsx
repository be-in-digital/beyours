"use client";

import Image from "next/image";
import Link from "next/link";

import { MobileNav } from "@/components/mobile-nav";
import { useSceneStore } from "@/store/scene-store";
import type { NavItem } from "@/sanity/types";

/**
 * NavbarShell — client component qui gère :
 *  - le glassmorphism scroll-triggered (lit useSceneStore alimenté par Lenis)
 *  - l'animation mount slide-down + fade-in (CSS keyframes pure, pas
 *    framer-motion → on ne tire plus framer dans le bundle critique)
 *  - le rendu des nav items / CTA / burger
 *
 * Reçoit les data depuis le `Navbar` server component qui les fetch dans
 * Sanity (siteSettings). Le mobile nav reçoit ces mêmes data en props.
 */
type Props = {
  navItems: NavItem[];
  ctaLabel: string;
  ctaHref: string;
};

export function NavbarShell({ navItems, ctaLabel, ctaHref }: Props) {
  const scrollY = useSceneStore((s) => s.scrollY);
  const scrolled = scrollY > 24;

  return (
    <header
      className={`bid-nav bid-nav-enter fixed inset-x-0 top-0 z-50 ${scrolled ? "bid-nav--scrolled" : ""}`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4 sm:px-10">
        <Link
          href="/"
          aria-label="Be in Digital — accueil"
          data-magnetic
          className="inline-flex items-center transition-opacity duration-300 hover:opacity-80"
        >
          <Image
            src="/brand/logo.png"
            alt="Be in Digital"
            width={489}
            height={161}
            priority
            className="h-10 w-auto sm:h-12"
          />
        </Link>

        <nav
          aria-label="Navigation principale"
          className="hidden items-center gap-10 md:flex"
        >
          {navItems.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              data-magnetic
              className="text-muted-foreground hover:text-foreground relative text-sm font-medium tracking-wide transition-colors duration-300"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link
          href={ctaHref}
          data-magnetic
          className="bg-primary text-primary-foreground glow-primary hover:glow-strong hidden items-center rounded-full px-5 py-2.5 text-sm font-medium tracking-wide transition-shadow duration-300 md:inline-flex"
        >
          {ctaLabel}
        </Link>

        <MobileNav
          navItems={navItems}
          ctaLabel={ctaLabel}
          ctaHref={ctaHref}
        />
      </div>

      <style>{`
        .bid-nav {
          background: transparent;
          border-bottom: 1px solid transparent;
          backdrop-filter: blur(0px);
          -webkit-backdrop-filter: blur(0px);
          transition:
            background-color 500ms cubic-bezier(0.16, 1, 0.3, 1),
            border-color 500ms cubic-bezier(0.16, 1, 0.3, 1),
            backdrop-filter 500ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .bid-nav--scrolled {
          background: rgba(9, 9, 9, 0.65);
          border-bottom-color: rgba(82, 207, 175, 0.10);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }
        .bid-nav-enter {
          /* slide-down + fade-in initial, en CSS pure (pas framer-motion) */
          animation: bid-nav-enter 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both;
        }
        @keyframes bid-nav-enter {
          0% {
            opacity: 0;
            transform: translateY(-56px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .bid-nav-enter {
            animation: none;
          }
        }
      `}</style>
    </header>
  );
}
