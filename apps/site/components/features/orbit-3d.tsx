"use client";

import { useEffect, useRef, useState } from "react";
import { useAnimationFrame, useReducedMotion } from "framer-motion";
import {
  Globe,
  ShoppingBag,
  Settings,
  Heart,
  Star,
  LayoutGrid,
  BookOpen,
  Layers,
  Zap,
  Trophy,
  BarChart3,
  Smartphone,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { Tilt3D } from "@/components/ui/tilt-3d";
import { features, pillarOrder, type Pillar } from "./features-data";

/**
 * Orbit3D — the ecosystem orbiting the restaurant in 3D.
 * Two elliptical rings drawn in perspective: nodes pass IN FRONT of the orb
 * (large, sharp) and then BEHIND it (small, faded, blurred).
 * They fly in from the centre, slow down and show a label on hover, and every
 * node is clickable (scrolls to the matching feature).
 * Positions are computed frame by frame (GPU transform/opacity).
 * Static under prefers-reduced-motion.
 */

const pillarIcons: Record<Pillar, LucideIcon> = {
  attirer: Globe,
  vendre: ShoppingBag,
  gerer: Settings,
  fideliser: Heart,
};

const orbitLabels: Record<Pillar, string> = {
  attirer: "Attirer",
  vendre: "Vendre",
  gerer: "Gérer",
  fideliser: "Fidéliser",
};

const pillarFullLabels: Record<Pillar, string> = {
  attirer: "Attirer de nouveaux clients",
  vendre: "Vendre en direct",
  gerer: "Gérer votre activité",
  fideliser: "Fidéliser & optimiser",
};

const featureIcons: Record<string, LucideIcon> = {
  "site-web-premium": Globe,
  "formation-google-business": Star,
  "commande-en-ligne": ShoppingBag,
  "experience-mobile": Smartphone,
  "dashboard-administrateur": LayoutGrid,
  "gestion-menu": BookOpen,
  "centralisation-commandes": Layers,
  "integration-plateformes": Zap,
  "fidelisation-gamification": Trophy,
  analytics: BarChart3,
};

// Rings: ellipse radii (px), speed (rad/s), minimum scale at the far side
const RING_PILLARS = { rx: 172, ry: 60, speed: 0.13, minScale: 0.8 };
const RING_FEATURES = { rx: 272, ry: 100, speed: -0.08, minScale: 0.68 };

type Ring = typeof RING_PILLARS;

const easeOutCubic = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

function applyPose(
  el: HTMLElement | null,
  angle: number,
  ring: Ring,
  appear: number,
) {
  if (!el) return;
  const x = Math.sin(angle) * ring.rx * appear;
  const depth = Math.cos(angle); // 1 = in front, -1 = behind
  const y = depth * ring.ry * appear;
  const scale =
    (ring.minScale + (1.06 - ring.minScale) * (depth + 1) * 0.5) *
    (0.5 + 0.5 * appear);
  el.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
  el.style.opacity = ((0.4 + 0.6 * (depth + 1) * 0.5) * appear).toFixed(3);
  el.style.zIndex = String(20 + Math.round(depth * 15)); // central orb sits at 20
  // slight blur as the node passes behind — the real depth cue
  el.style.filter = depth < -0.12 ? `blur(${(-depth * 1.5).toFixed(1)}px)` : "";
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function Orbit3D() {
  const reduce = useReducedMotion();
  const pillarRefs = useRef<(HTMLElement | null)[]>([]);
  const featureRefs = useRef<(HTMLElement | null)[]>([]);
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const hoverRef = useRef<string | null>(null);
  useEffect(() => {
    hoverRef.current = hoverLabel;
  }, [hoverLabel]);

  const angles = useRef({ pillars: 0, features: 0.5 });
  const speedFactor = useRef(1);
  const start = useRef<number | null>(null);

  useAnimationFrame((t, delta) => {
    if (reduce) return;
    if (start.current === null) start.current = t;
    const elapsed = (t - start.current) / 1000;
    const dt = Math.min(delta, 64) / 1000;

    // slowed down on hover, lerped
    const target = hoverRef.current ? 0.1 : 1;
    speedFactor.current += (target - speedFactor.current) * 0.07;
    angles.current.pillars += dt * RING_PILLARS.speed * speedFactor.current;
    angles.current.features += dt * RING_FEATURES.speed * speedFactor.current;

    pillarOrder.forEach((_, i) => {
      const base = (i / pillarOrder.length) * Math.PI * 2;
      const appear = easeOutCubic((elapsed - 0.15 - i * 0.07) / 0.9);
      applyPose(pillarRefs.current[i] ?? null, base + angles.current.pillars, RING_PILLARS, appear);
    });
    features.forEach((_, i) => {
      const base = (i / features.length) * Math.PI * 2;
      const appear = easeOutCubic((elapsed - 0.4 - i * 0.05) / 0.9);
      applyPose(featureRefs.current[i] ?? null, base + angles.current.features + 0.5, RING_FEATURES, appear);
    });
  });

  return (
    <Tilt3D maxTilt={10} scale={1} className="mx-auto w-fit">
      <div className="relative h-[540px] w-[620px]">
        {/* Traces d'orbite elliptiques */}
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 h-[120px] w-[344px] -translate-x-1/2 -translate-y-1/2 rounded-[100%] border border-primary/15"
        />
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 h-[200px] w-[544px] -translate-x-1/2 -translate-y-1/2 rounded-[100%] border border-[color:var(--border)]"
        />

        {/* Ground shadow — anchors the whole system */}
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-[76%] h-16 w-[380px] -translate-x-1/2 rounded-[100%] bg-[radial-gradient(50%_50%_at_50%_50%,rgba(112,60,34,0.14),transparent_70%)] blur-md"
        />

        {/* Halo behind the orb */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.10] blur-3xl"
        />

        {/* Central orb — the restaurant */}
        <div
          className="absolute left-1/2 top-1/2 grid h-28 w-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[color:var(--border-accent)] bg-surface-1 shadow-[0_18px_44px_-20px_rgba(197,84,44,0.5)]"
          style={{ zIndex: 20 }}
        >
          {/* dashed ring rotating around the orb */}
          <svg
            aria-hidden="true"
            className="absolute -inset-3 h-[calc(100%+24px)] w-[calc(100%+24px)] animate-[spin_28s_linear_infinite]"
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r="48"
              fill="none"
              stroke="rgba(197,84,44,0.3)"
              strokeWidth="1"
              strokeDasharray="2 5"
            />
          </svg>
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_10px_24px_-10px_rgba(197,84,44,0.7)]">
            <Utensils className="h-7 w-7" strokeWidth={1.8} />
          </span>
        </div>

        {/* Inner ring — the 4 pillars (clickable) */}
        {pillarOrder.map((key, i) => {
          const Icon = pillarIcons[key];
          const base = (i / pillarOrder.length) * Math.PI * 2;
          return (
            <button
              key={key}
              type="button"
              ref={(el) => {
                pillarRefs.current[i] = el;
                if (el && !el.dataset.posed) {
                  el.dataset.posed = "1";
                  applyPose(el, base, RING_PILLARS, 1);
                }
              }}
              onClick={() => scrollToId("features-bento")}
              onMouseEnter={() => setHoverLabel(pillarFullLabels[key])}
              onMouseLeave={() => setHoverLabel(null)}
              onFocus={() => setHoverLabel(pillarFullLabels[key])}
              onBlur={() => setHoverLabel(null)}
              aria-label={`Voir les fonctionnalités : ${pillarFullLabels[key]}`}
              className="absolute left-1/2 top-1/2 cursor-pointer rounded-2xl will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
            >
              <span className="flex h-20 w-20 flex-col items-center justify-center gap-1.5 rounded-2xl border border-[color:var(--border)] bg-surface-1 px-2 shadow-[0_14px_32px_-18px_rgba(112,60,34,0.5)] transition-colors duration-200 hover:border-[color:var(--border-accent)]">
                <Icon className="h-5 w-5 text-primary-ink" strokeWidth={1.8} />
                <span className="text-center text-[9px] font-semibold uppercase tracking-wide leading-none text-muted-foreground">
                  {orbitLabels[key]}
                </span>
              </span>
            </button>
          );
        })}

        {/* Outer ring — the 10 features (clickable) */}
        {features.map((feature, i) => {
          const Icon = featureIcons[feature.id] ?? Star;
          const base = (i / features.length) * Math.PI * 2 + 0.5;
          return (
            <button
              key={feature.id}
              type="button"
              ref={(el) => {
                featureRefs.current[i] = el;
                if (el && !el.dataset.posed) {
                  el.dataset.posed = "1";
                  applyPose(el, base, RING_FEATURES, 1);
                }
              }}
              onClick={() => scrollToId(feature.id)}
              onMouseEnter={() => setHoverLabel(feature.title)}
              onMouseLeave={() => setHoverLabel(null)}
              onFocus={() => setHoverLabel(feature.title)}
              onBlur={() => setHoverLabel(null)}
              aria-label={`Aller à : ${feature.title}`}
              className="absolute left-1/2 top-1/2 cursor-pointer rounded-xl will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-[color:var(--border)] bg-surface-1 text-primary-ink shadow-[0_10px_24px_-14px_rgba(112,60,34,0.55)] transition-colors duration-200 hover:border-[color:var(--border-accent)] hover:bg-primary/5">
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </span>
            </button>
          );
        })}

        {/* Label of the hovered node */}
        <div className="pointer-events-none absolute inset-x-0 bottom-1 flex justify-center">
          <span
            className={`rounded-full border border-[color:var(--border-accent)] bg-surface-1 px-4 py-1.5 text-xs font-semibold text-primary-ink shadow-[0_10px_24px_-14px_rgba(112,60,34,0.5)] transition-all duration-300 ${
              hoverLabel ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
            }`}
          >
            {hoverLabel ?? " "}
          </span>
        </div>
      </div>
    </Tilt3D>
  );
}
