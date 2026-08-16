"use client";

import { useState } from "react";
import { Utensils } from "lucide-react";
import { SectionBadge } from "@/components/ui/section-badge";
import { FadeIn, ScaleIn } from "@/components/ui/motion";
import { MobileCarousel } from "@/components/ui/mobile-carousel";
import { Tilt3D } from "@/components/ui/tilt-3d";

const proofs = [
  {
    keyword: "Terrain",
    title: "Spécialisation restauration",
    description:
      "Pas de fonctionnalités génériques. Tout est pensé pour les enjeux d'un restaurant.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
        <path d="M7 2v20" />
        <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
      </svg>
    ),
  },
  {
    keyword: "Premium",
    title: "Design premium",
    description:
      "Votre présence digitale reflète enfin la qualité réelle de votre établissement.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="13.5" cy="6.5" r="2.5" />
        <path d="M17 2a5 5 0 0 1 0 9" />
        <path d="M2 21a10 10 0 0 1 11-10" />
        <path d="m21.64 15.23-4.51 6.71a1 1 0 0 1-1.67-.01l-2.64-3.95" />
      </svg>
    ),
  },
  {
    keyword: "Sur mesure",
    title: "Approche sur mesure",
    description:
      "Votre plateforme s'adapte à votre identité, votre fonctionnement et vos objectifs.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    keyword: "Humain",
    title: "Accompagnement humain",
    description:
      "Une équipe vous guide du cadrage initial jusqu'à la montée en puissance.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    keyword: "Business",
    title: "Vision business",
    description:
      "Chaque module sert un objectif concret : image, acquisition, fidélisation ou pilotage.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
  },
  {
    keyword: "Scalable",
    title: "Stack moderne",
    description:
      "Une base technique solide pour la performance, la sécurité et l'évolutivité.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
];

export function TrustSection() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <section id="trust" className="relative py-16 sm:py-24 lg:py-32 overflow-hidden">
      {/* Section ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-primary/[0.025] rounded-full blur-[80px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        {/* ── Header ── */}
        <FadeIn>
          <SectionBadge text="Pourquoi BeYours" />
          <div className="text-center max-w-3xl mx-auto mt-6 mb-16 lg:mb-20">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-[2.9rem] font-semibold tracking-[-0.02em] leading-[1.1]">
              Pensé pour la restauration.{" "}
              <span className="text-primary">Construit pour durer.</span>
            </h2>
            <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Nous ne partons pas d&apos;un produit générique à adapter. Chaque
              détail de la plateforme a été conçu pour répondre aux réalités du
              terrain.
            </p>
          </div>
        </FadeIn>

        {/* ── Hub & Spokes layout ── */}
        <ScaleIn delay={0.15} className="relative">
          {/* ── Desktop: hub-and-spokes ── */}
          <div className="hidden lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-8 lg:items-center">
            {/* Left column — 3 proof nodes */}
            <div className="flex flex-col gap-4">
              {proofs.slice(0, 3).map((proof, i) => (
                <ProofCard
                  key={proof.title}
                  proof={proof}
                  index={i}
                  hovered={hovered}
                  onHover={setHovered}
                  side="left"
                />
              ))}
            </div>

            {/* Center — The Seal */}
            <div className="relative flex items-center justify-center">
              {/* Connection lines — left */}
              <svg
                className="absolute right-1/2 top-0 bottom-0 w-1/2 pointer-events-none"
                viewBox="0 0 200 400"
                preserveAspectRatio="none"
                fill="none"
              >
                {[0, 1, 2].map((i) => {
                  const y = 67 + i * 133;
                  return (
                    <line
                      key={`l-${i}`}
                      x1="0"
                      y1={y}
                      x2="200"
                      y2="200"
                      stroke={
                        hovered === i
                          ? "rgba(197,84,44,0.45)"
                          : "rgba(197,84,44,0.16)"
                      }
                      strokeWidth="1"
                      style={{ transition: "stroke 0.3s ease" }}
                    />
                  );
                })}
              </svg>
              {/* Connection lines — right */}
              <svg
                className="absolute left-1/2 top-0 bottom-0 w-1/2 pointer-events-none"
                viewBox="0 0 200 400"
                preserveAspectRatio="none"
                fill="none"
              >
                {[3, 4, 5].map((i) => {
                  const y = 67 + (i - 3) * 133;
                  return (
                    <line
                      key={`r-${i}`}
                      x1="200"
                      y1={y}
                      x2="0"
                      y2="200"
                      stroke={
                        hovered === i
                          ? "rgba(197,84,44,0.45)"
                          : "rgba(197,84,44,0.16)"
                      }
                      strokeWidth="1"
                      style={{ transition: "stroke 0.3s ease" }}
                    />
                  );
                })}
              </svg>

              {/* The central seal */}
              <CentralSeal keyword={hovered !== null ? (proofs[hovered]?.keyword ?? null) : null} />
            </div>

            {/* Right column — 3 proof nodes */}
            <div className="flex flex-col gap-4">
              {proofs.slice(3, 6).map((proof, i) => (
                <ProofCard
                  key={proof.title}
                  proof={proof}
                  index={i + 3}
                  hovered={hovered}
                  onHover={setHovered}
                  side="right"
                />
              ))}
            </div>
          </div>

          {/* ── Tablet: grid ── */}
          <div className="hidden sm:grid sm:grid-cols-2 gap-4 lg:hidden">
            <div className="sm:col-span-2 flex justify-center mb-4">
              <CentralSeal keyword={null} />
            </div>
            {proofs.map((proof, i) => (
              <ProofCard
                key={proof.title}
                proof={proof}
                index={i}
                hovered={hovered}
                onHover={setHovered}
                side="left"
              />
            ))}
          </div>

          {/* ── Mobile: carousel ── */}
          <div className="sm:hidden flex flex-col items-center gap-8">
            <CentralSeal keyword={null} />
            <div className="w-full">
              <MobileCarousel>
                {proofs.map((proof, i) => (
                  <ProofCard
                    key={proof.title}
                    proof={proof}
                    index={i}
                    hovered={hovered}
                    onHover={setHovered}
                    side="left"
                  />
                ))}
              </MobileCarousel>
            </div>
          </div>
        </ScaleIn>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════
   Central Seal — glowing badge
   ════════════════════════════════════════════════ */

function CentralSeal({ keyword }: { keyword: string | null }) {
  return (
    <div className="flex shrink-0 flex-col items-center">
      {/* Medallion with real depth: perspective + stacked layers (translateZ),
          tilting towards the mouse — the same 3D language as the hero storefront */}
      <Tilt3D maxTilt={13} scale={1.02} className="animate-float">
        <div
          className="relative grid h-[240px] w-[240px] place-items-center sm:h-[270px] sm:w-[270px]"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Base disc */}
          <div className="absolute inset-0 rounded-full border border-[color:var(--border)] bg-surface-1 shadow-[0_36px_80px_-32px_rgba(112,60,34,0.55)]" />
          {/* Halo chaud interne */}
          <div
            aria-hidden="true"
            className="absolute inset-8 rounded-full bg-primary/[0.06]"
            style={{ transform: "translateZ(14px)" }}
          />

          {/* Rotating dashed ring — middle layer */}
          <div
            aria-hidden="true"
            className="absolute inset-3"
            style={{ transform: "translateZ(26px)" }}
          >
            <svg
              className="h-full w-full animate-[spin_50s_linear_infinite]"
              viewBox="0 0 100 100"
            >
              <circle
                cx="50"
                cy="50"
                r="47"
                fill="none"
                stroke="rgba(197,84,44,0.28)"
                strokeWidth="0.8"
                strokeDasharray="3 4"
              />
            </svg>
          </div>

          {/* Heart of the medallion — the closest layer */}
          <div
            className="relative flex flex-col items-center"
            style={{ transform: "translateZ(48px)" }}
          >
            <span className="grid h-20 w-20 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_18px_36px_-14px_rgba(197,84,44,0.65)]">
              <Utensils className="h-8 w-8" strokeWidth={1.7} />
            </span>
            {/* Keyword of the hovered pillar — only visible while hovering a card */}
            <span
              className={`mt-3 rounded-full border border-[color:var(--border-accent)] bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition-all duration-300 ${
                keyword ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
              }`}
            >
              {keyword ?? " "}
            </span>
          </div>
        </div>
      </Tilt3D>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Proof Card — each differentiator
   ════════════════════════════════════════════════ */

interface ProofCardProps {
  proof: (typeof proofs)[number];
  index: number;
  hovered: number | null;
  onHover: (i: number | null) => void;
  side: "left" | "right";
}

function ProofCard({ proof, index, hovered, onHover, side }: ProofCardProps) {
  const isActive = hovered === index;

  return (
    <div
      className={`relative h-full p-5 rounded-xl border transition-all duration-300 cursor-default ${
        isActive
          ? "bg-surface-1 border-primary/30 shadow-[0_14px_36px_-20px_rgba(197,84,44,0.4)]"
          : "bg-surface-1 border-[color:var(--border)] hover:bg-secondary"
      }`}
      onMouseEnter={() => onHover(index)}
      onMouseLeave={() => onHover(null)}
    >
      <div className={`flex items-start gap-4 ${side === "right" ? "lg:flex-row-reverse lg:text-right" : ""}`}>
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-all duration-300 ${
            isActive
              ? "bg-primary/15 border border-primary/25 text-primary"
              : "bg-secondary border border-[color:var(--border)] text-muted-foreground"
          }`}
        >
          {proof.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className={`text-sm font-semibold transition-colors duration-300 ${
              isActive ? "text-foreground" : "text-foreground/70"
            }`}
          >
            {proof.title}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed mt-1">
            {proof.description}
          </p>
        </div>
      </div>

      {/* Active indicator dot */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full transition-all duration-300 ${
          side === "left" ? "right-0 translate-x-1/2" : "left-0 -translate-x-1/2"
        } ${isActive ? "bg-primary/60 scale-100" : "bg-transparent scale-0"}`}
      />
    </div>
  );
}
