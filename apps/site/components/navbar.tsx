"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { useCalendlyModal } from "@/lib/store";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Accueil", href: "/" },
  { label: "Fonctionnalités", href: "/fonctionnalites" },
  { label: "Démo", href: "/decouvrir" },
  { label: "Templates", href: "/templates" },
  { label: "Tarifs", href: "/tarifs" },
  { label: "À propos", href: "/a-propos" },
  { label: "Contact", href: "/contact" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { open: openCalendly } = useCalendlyModal();
  const pathname = usePathname();
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (y) => {
    setScrolled(y > 40);
  });

  return (
    <motion.nav
      initial={false}
      animate={{
        paddingTop: scrolled ? 8 : 16,
      }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6"
      aria-label="Navigation principale"
    >
      <motion.div
        initial={false}
        animate={{
          maxWidth: scrolled ? 880 : 1120,
          borderColor: scrolled
            ? "rgba(34,28,21,0.14)"
            : "rgba(34,28,21,0.08)",
          backgroundColor: scrolled
            ? "rgba(250,245,238,0.82)"
            : "rgba(255,253,249,0.6)",
          boxShadow: scrolled
            ? "0 14px 40px -18px rgba(112,60,34,0.35), 0 0 0 1px rgba(197,84,44,0.06)"
            : "0 10px 30px -20px rgba(112,60,34,0.25)",
        }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "relative mx-auto rounded-full border backdrop-blur-xl",
          mobileOpen && "!bg-surface-1"
        )}
      >
        <div className="px-4 sm:px-6 flex items-center justify-between gap-4 lg:gap-6 h-14">
          <Link href="/" className="flex items-center shrink-0" aria-label="BeYours — Retour à l'accueil">
            <Logo width={120} height={40} priority linked={false} />
          </Link>

          {/* Desktop links */}
          <ul className="hidden lg:flex items-center gap-5 xl:gap-7" role="list">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={cn(
                      "relative text-sm whitespace-nowrap transition-colors duration-200",
                      isActive
                        ? "text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {link.label}
                    {isActive && (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute -bottom-1.5 left-0 right-0 mx-auto h-px w-4 bg-primary"
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Desktop CTA */}
          <button
            onClick={openCalendly}
            className="hidden lg:inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground whitespace-nowrap transition-[filter,transform] duration-200 hover:brightness-110 active:scale-[0.98] cursor-pointer shrink-0 glow-primary"
          >
            Réserver un appel
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M1 13L13 1M13 1H3M13 1V11" />
            </svg>
          </button>

          {/* Mobile toggle */}
          <button
            className="lg:hidden p-2 text-foreground cursor-pointer"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M3 6h18M7 12h14M12 18h9" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="lg:hidden absolute top-full left-0 right-0 mt-3 rounded-2xl border border-[color:var(--border-subtle)] bg-surface-1 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
          >
            <div className="px-5 py-4 flex flex-col gap-3">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "text-sm transition-colors",
                      isActive
                        ? "text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setMobileOpen(false)}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <button
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground mt-2 cursor-pointer"
                onClick={() => {
                  setMobileOpen(false);
                  openCalendly();
                }}
              >
                Réserver un appel
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </motion.nav>
  );
}
