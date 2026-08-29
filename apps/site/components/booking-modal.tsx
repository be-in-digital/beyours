"use client";

import { useEffect } from "react";
import Cal, { getCalApi } from "@calcom/embed-react";
import { useBookingModal, type BookingVariant } from "@/lib/store";
import { BOOKING_ORIGIN } from "@/lib/site-config";

// Booking runs on bookself.app (Cal.com), under the BeYours brand. The old
// link pointed at calendly.com/hello-beindigital — the agency, on a site that
// sells BeYours. Two events, two audiences:
//   decouverte : public, prospects with questions
//   lancement  : post-purchase kickoff, linked from /checkout/success only
// Self-hosted Cal.com instance, so both the origin and the embed script have to
// be pointed at it explicitly. The origin comes from lib/site-config because
// the CSP in next.config.ts has to allow the very same one.
const CAL_ORIGIN = BOOKING_ORIGIN;
const CAL_EMBED_JS = `${CAL_ORIGIN}/embed/embed.js`;

const BOOKING_LINKS: Record<BookingVariant, string> = {
  decouverte: "beyours/decouverte",
  lancement: "beyours/lancement",
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

export function BookingModal() {
  const { isOpen, close, variant } = useBookingModal();

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

  // Cal exposes its own CSS variables. Feed it the site accent so the buttons
  // inside the calendar match the page: DESIGN.md locks a single accent
  // (terracotta #c5542c) and bans the teal Cal ships as its default.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void (async () => {
      const cal = await getCalApi({
        namespace: variant,
        embedJsUrl: CAL_EMBED_JS,
      });
      if (cancelled) return;
      cal("ui", {
        theme: "light",
        cssVarsPerTheme: {
          light: { "cal-brand": "#c5542c" },
          dark: { "cal-brand": "#c5542c" },
        },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, variant]);

  if (!isOpen) return null;

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

        {/* Cal.com embed. Sizes itself to its content, unlike the raw iframe it
            replaced, which was pinned to a fixed height and cramped on mobile. */}
        <div className="flex-1 overflow-y-auto">
          <Cal
            namespace={variant}
            calLink={BOOKING_LINKS[variant]}
            calOrigin={CAL_ORIGIN}
            embedJsUrl={CAL_EMBED_JS}
            config={{ theme: "light", layout: "month_view" }}
            style={{ width: "100%", height: "100%", overflow: "scroll" }}
          />
        </div>
      </div>
    </div>
  );
}
