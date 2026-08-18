"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { useCalendlyModal } from "@/lib/store";
import { Logo } from "@/components/ui/logo";
import { SITE_WHATSAPP_URL } from "@/lib/site-config";
import { cn } from "@/lib/utils";

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.198-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12.05 21.785h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 0 1 6.988 2.896 9.83 9.83 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.8 11.8 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.9 11.9 0 0 0 5.688 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.82 11.82 0 0 0 20.465 3.488" />
    </svg>
  );
}

/**
 * The four links that follow the buying decision: what it does → see it →
 * what it looks like → how much. Accueil is the logo's job, À propos and
 * Contact live in the footer — a marketing nav that funnels to one CTA can't
 * afford seven exits.
 */
const navLinks = [
  { label: "Fonctionnalités", href: "/fonctionnalites" },
  { label: "Démo", href: "/decouvrir" },
  { label: "Modèles", href: "/templates" },
  { label: "Tarifs", href: "/tarifs" },
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
            <Logo width={120} height={28} priority linked={false} />
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

          {/* Desktop actions — two exits, two levels of commitment */}
          <div className="hidden lg:flex items-center gap-4 xl:gap-5 shrink-0">
            <a
              href={SITE_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm whitespace-nowrap text-muted-foreground transition-colors duration-200 hover:text-foreground"
            >
              <WhatsAppIcon />
              Une question&nbsp;?
            </a>

            <button
              onClick={() => openCalendly()}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground whitespace-nowrap transition-[filter,transform] duration-200 hover:brightness-110 active:scale-[0.98] cursor-pointer glow-primary"
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
          </div>

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
              <a
                href={SITE_WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setMobileOpen(false)}
              >
                <WhatsAppIcon />
                Une question&nbsp;?
              </a>
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
