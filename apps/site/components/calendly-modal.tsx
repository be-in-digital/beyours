"use client";

import { useEffect } from "react";
import { useCalendlyModal, type BookingVariant } from "@/lib/store";

// Booking runs on bookself.app (Cal.com), under the BeYours brand. The old
// link pointed at calendly.com/hello-beindigital — the agency, on a site that
// sells BeYours. Two events, two audiences:
//   decouverte : public, prospects with questions
//   lancement  : post-purchase kickoff, linked from /checkout/success only
const BOOKING_URLS: Record<BookingVariant, string> = {
  decouverte: "https://bookself.app/beyours/decouverte",
  lancement: "https://bookself.app/beyours/lancement",
};

const BOOKING_COPY: Record<BookingVariant, { title: string; subtitle: string }> = {
  decouverte: {
    title: "Réserver un appel",
    subtitle: "Choisissez un créneau qui vous convient",
  },
  lancement: {
    title: "Lancer votre site",
    subtitle: "Choisissez un créneau pour la mise en route",
  },
};

export function CalendlyModal() {
  const { isOpen, close, variant } = useCalendlyModal();

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    if (isOpen) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, close]);

  if (!isOpen) return null;

  // Cal.com honours ?theme; the Calendly-specific colour params it replaced were
  // silently ignored here.
  const embedUrl = `${BOOKING_URLS[variant]}?theme=light`;
  const copy = BOOKING_COPY[variant];

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[color:var(--olive)]/50 backdrop-blur-sm"
        onClick={close}
      />

      {/* Modal */}
      <div className="relative w-full sm:max-w-2xl h-[90vh] sm:h-[85vh] max-h-[750px] rounded-t-2xl sm:rounded-2xl border border-[color:var(--border)] bg-background shadow-[0_30px_80px_-30px_rgba(112,60,34,0.5)] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="relative flex items-center justify-between px-6 py-4 border-b border-[color:var(--border)]">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {copy.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {copy.subtitle}
            </p>
          </div>
          <button
            onClick={close}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Fermer"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Calendly iframe */}
        <div className="flex-1 relative">
          <iframe
            src={embedUrl}
            className="absolute inset-0 w-full h-full border-0"
            title="Réserver un appel — Calendly"
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
}
