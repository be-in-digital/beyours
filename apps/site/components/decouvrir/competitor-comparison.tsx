"use client";

import { Check, X, Minus } from "lucide-react";
import { FadeIn } from "@/components/ui/motion";
import { cn } from "@/lib/utils";
import { formatPrice, plans } from "@/components/pricing/pricing-data";

/* ═══════════════════════════════════════════════
   Honest comparison, one business model at a time.
   Sourced figures (see « Sources » at the bottom of the page). No competitor
   price is invented: public ranges, or the model described as published.
   ═══════════════════════════════════════════════ */

type Tone = "good" | "bad" | "neutral";
type Cell = { text: string; tone: Tone };

const MODELS = [
  { name: "Plateformes de livraison", sub: "Uber Eats, Deliveroo" },
  { name: "Logiciels par abonnement", sub: "Zenchef, Sunday, TheFork…" },
  { name: "Agence sur mesure", sub: "site classique" },
  { name: "BeYours", sub: "achat + maintenance", highlight: true },
];

const ROWS: { label: string; cells: [Cell, Cell, Cell, Cell] }[] = [
  {
    label: "Commission sur vos ventes",
    cells: [
      { text: "25 à 36 %", tone: "bad" },
      { text: "0 % en direct", tone: "good" },
      { text: "0 %", tone: "good" },
      { text: "0 % en direct", tone: "good" },
    ],
  },
  {
    label: "Coût récurrent",
    cells: [
      { text: "Aucun, mais dépendance totale", tone: "neutral" },
      { text: "69 à 149 €/mois et +", tone: "bad" },
      { text: "Variable, au forfait", tone: "neutral" },
      {
        // Derived, never restated: `convex/planPrices.ts` is what the checkout
        // charges, and a comparison table quoting a price we do not take is a
        // claim about a competitor AND about ourselves.
        text: `${formatPrice(
          plans.find((plan) => plan.slug === "essentielle")!.maintenanceYearly,
        )}\u00a0€/an de maintenance`,
        tone: "good",
      },
    ],
  },
  {
    label: "Vous possédez vos clients (emails, data)",
    cells: [
      { text: "Non, la plateforme les garde", tone: "bad" },
      { text: "Selon l'outil", tone: "neutral" },
      { text: "Oui", tone: "good" },
      { text: "Oui, base opt-in", tone: "good" },
    ],
  },
  {
    label: "Fidélité + jeu concours inclus",
    cells: [
      { text: "Non", tone: "bad" },
      { text: "Option 49 à 226 €/mois", tone: "bad" },
      { text: "Rarement", tone: "bad" },
      { text: "Inclus", tone: "good" },
    ],
  },
  {
    label: "Site premium à votre marque",
    cells: [
      { text: "Non, leur page", tone: "bad" },
      { text: "Oui", tone: "good" },
      { text: "Oui", tone: "good" },
      { text: "Oui", tone: "good" },
    ],
  },
  {
    label: "Évolutions",
    cells: [
      { text: "Vous ne maîtrisez rien", tone: "bad" },
      { text: "Abonnement à vie", tone: "neutral" },
      { text: "Au devis, souvent cher", tone: "neutral" },
      { text: "Mineures incluses", tone: "good" },
    ],
  },
  {
    label: "Engagement",
    cells: [
      { text: "Dépendance forte", tone: "bad" },
      { text: "Mensuel reconductible", tone: "neutral" },
      { text: "Projet ponctuel", tone: "neutral" },
      { text: "1 an, puis libre", tone: "good" },
    ],
  },
];

function ToneIcon({ tone }: { tone: Tone }) {
  if (tone === "good")
    return <Check className="h-4 w-4 shrink-0 text-[color:var(--success)]" />;
  if (tone === "bad")
    return <X className="h-4 w-4 shrink-0 text-[color:var(--danger)]" />;
  return <Minus className="h-4 w-4 shrink-0 text-muted-foreground/50" />;
}

export function CompetitorComparison() {
  return (
    <div>
      {/* Desktop — tableau */}
      <FadeIn>
        <div className="hidden overflow-hidden rounded-2xl border border-[color:var(--border)] md:block">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-[22%] bg-surface-2 p-4 text-left align-bottom font-medium text-muted-foreground">
                  Ce qui compte pour vous
                </th>
                {MODELS.map((m) => (
                  <th
                    key={m.name}
                    className={cn(
                      "p-4 text-left align-bottom",
                      m.highlight
                        ? "bg-primary text-primary-foreground"
                        : "bg-surface-2",
                    )}
                  >
                    <span className="block font-display text-base font-semibold">
                      {m.name}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-normal",
                        m.highlight
                          ? "text-primary-foreground/75"
                          : "text-muted-foreground",
                      )}
                    >
                      {m.sub}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, ri) => (
                <tr
                  key={row.label}
                  className={ri % 2 ? "bg-surface-1" : "bg-background"}
                >
                  <td className="p-4 align-top font-medium text-foreground">
                    {row.label}
                  </td>
                  {row.cells.map((c, ci) => (
                    <td
                      key={ci}
                      className={cn(
                        "p-4 align-top",
                        MODELS[ci]?.highlight &&
                          "bg-primary/[0.05] font-medium",
                      )}
                    >
                      <span className="flex items-start gap-2">
                        <ToneIcon tone={c.tone} />
                        <span
                          className={
                            c.tone === "bad"
                              ? "text-muted-foreground"
                              : "text-foreground"
                          }
                        >
                          {c.text}
                        </span>
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FadeIn>

      {/* Mobile — one card per model */}
      <div className="grid gap-4 md:hidden">
        {MODELS.map((m, mi) => (
          <FadeIn key={m.name} delay={mi * 0.05}>
            <div
              className={cn(
                "rounded-2xl border p-5",
                m.highlight
                  ? "border-[color:var(--border-accent)] bg-primary/[0.05]"
                  : "border-[color:var(--border)] bg-surface-1",
              )}
            >
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <span className="font-display text-base font-semibold">
                  {m.name}
                </span>
                <span className="text-xs text-muted-foreground">{m.sub}</span>
              </div>
              <ul className="space-y-2.5">
                {ROWS.map((row) => {
                  const c = row.cells[mi];
                  if (!c) return null;
                  return (
                    <li key={row.label} className="flex items-start gap-2 text-sm">
                      <ToneIcon tone={c.tone} />
                      <span>
                        <span className="text-muted-foreground">
                          {row.label} :{" "}
                        </span>
                        <span className="font-medium text-foreground">
                          {c.text}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </FadeIn>
        ))}
      </div>

      <p className="mt-6 text-xs leading-relaxed text-muted-foreground/70">
        Fourchettes issues de sources publiques (juillet 2026) : Uber Eats 30 % HT
        (33 à 36 % coût réel avec frais et TVA), Deliveroo 25 à 32 %. Logiciels :
        Zenchef 69 à 149 €/mois, TheFork ~139 €/mois plus ~2,60 €/couvert. Roue de
        collecte d&apos;avis en marque blanche : Drimify, Easypromos, Qualifio, 49 à
        226 €/mois. Détail des sources en bas de page.
      </p>
    </div>
  );
}
