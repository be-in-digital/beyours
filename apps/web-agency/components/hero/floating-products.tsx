"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";
import Image from "next/image";

/**
 * FloatingProducts — composition de 4 cards des projets, en perspective
 * 3D CSS. Pas de canvas, pas de WebGL. Glassmorphism + drop-shadow doux
 * + bobbing offset pour un vibe "antigravity".
 *
 * Au mouvement de souris dans le container, le groupe entier tilte
 * légèrement (parallax 3D). Chaque card a son propre offset Y et delay
 * d'animation pour que l'ensemble respire.
 */

type Product = {
  slug: string;
  label: string;
  category: string;
  href?: string;
  position: { top: string; left: string };
  size: { w: number; h: number }; // px
  rotate: { x: number; y: number; z: number };
  delay: number;
  bobDuration: number;
};

const PRODUCTS: Product[] = [
  {
    slug: "bid-restaurant",
    label: "Be in Digital Restaurant",
    category: "SaaS · Restauration",
    href: "https://restaurant.beindigital.fr",
    position: { top: "8%", left: "18%" },
    size: { w: 360, h: 230 },
    rotate: { x: -8, y: -14, z: -2 },
    delay: 0.1,
    bobDuration: 8,
  },
  {
    slug: "wedilly-bird",
    label: "Wedilly Bird",
    category: "Plateforme événementielle",
    position: { top: "5%", left: "62%" },
    size: { w: 240, h: 150 },
    rotate: { x: -6, y: 12, z: 3 },
    delay: 0.25,
    bobDuration: 10,
  },
  {
    slug: "maison-binato",
    label: "Maison Binato",
    category: "E-commerce · Mode",
    position: { top: "55%", left: "65%" },
    size: { w: 220, h: 140 },
    rotate: { x: 5, y: 16, z: -3 },
    delay: 0.4,
    bobDuration: 7,
  },
  {
    slug: "jokko",
    label: "Jokko",
    category: "Mise en relation",
    position: { top: "62%", left: "10%" },
    size: { w: 200, h: 130 },
    rotate: { x: 4, y: -10, z: 2 },
    delay: 0.55,
    bobDuration: 9,
  },
];

export function FloatingProducts() {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-1, 1], [4, -4]), { damping: 30 });
  const ry = useSpring(useTransform(mx, [-1, 1], [-6, 6]), { damping: 30 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isTouch = window.matchMedia("(hover: none)").matches;
    if (isTouch) return;

    const onMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      mx.set(x);
      my.set(y);
    };
    document.addEventListener("mousemove", onMove, { passive: true });
    return () => document.removeEventListener("mousemove", onMove);
  }, [mx, my]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[5] hidden md:block"
      style={{ perspective: "1400px", perspectiveOrigin: "50% 50%" }}
    >
      <motion.div
        className="relative h-full w-full"
        style={{
          rotateX: rx,
          rotateY: ry,
          transformStyle: "preserve-3d",
        }}
      >
        {PRODUCTS.map((p) => (
          <FloatingCard key={p.slug} product={p} />
        ))}
      </motion.div>
    </div>
  );
}

function FloatingCard({ product }: { product: Product }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 60, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 1.2,
        delay: product.delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="bid-float-card absolute"
      style={{
        top: product.position.top,
        left: product.position.left,
        width: product.size.w,
        height: product.size.h,
        transform: `rotateX(${product.rotate.x}deg) rotateY(${product.rotate.y}deg) rotateZ(${product.rotate.z}deg)`,
        transformStyle: "preserve-3d",
        animation: `bid-bob ${product.bobDuration}s ease-in-out infinite`,
        animationDelay: `${product.delay}s`,
      }}
    >
      {/* Glow halo derrière la card */}
      <div className="bid-card-halo" aria-hidden="true" />

      {/* Card body avec glassmorphism + screenshot */}
      <div className="bid-card-body">
        <Image
          src={`/work/${product.slug}.png`}
          alt={product.label}
          fill
          sizes="(max-width: 768px) 0vw, 360px"
          className="object-cover"
          priority={product.delay < 0.2}
        />
        {/* Tint mint subtle pour cohérence chromatique */}
        <div className="bid-card-tint" />
        {/* Footer label en glassmorphism */}
        <div className="bid-card-meta">
          <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-primary/90">
            {product.category}
          </p>
          <p className="font-display mt-0.5 text-sm font-light text-foreground">
            {product.label}
          </p>
        </div>
      </div>

      <style>{`
        .bid-float-card {
          will-change: transform;
        }
        .bid-card-halo {
          position: absolute;
          inset: -16px;
          border-radius: 24px;
          background: radial-gradient(
            ellipse at center,
            rgba(82, 207, 175, 0.30) 0%,
            transparent 70%
          );
          filter: blur(20px);
          pointer-events: none;
        }
        .bid-card-body {
          position: relative;
          width: 100%;
          height: 100%;
          border-radius: 14px;
          overflow: hidden;
          background: rgba(15, 15, 15, 0.55);
          border: 1px solid rgba(82, 207, 175, 0.18);
          box-shadow:
            0 22px 50px rgba(0, 0, 0, 0.55),
            0 0 0 1px rgba(82, 207, 175, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .bid-card-tint {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            180deg,
            rgba(82, 207, 175, 0.04) 0%,
            transparent 30%,
            rgba(0, 0, 0, 0.45) 100%
          );
          pointer-events: none;
        }
        .bid-card-meta {
          position: absolute;
          bottom: 12px;
          left: 12px;
          right: 12px;
          padding: 8px 12px;
          border-radius: 8px;
          background: rgba(9, 9, 9, 0.65);
          border: 1px solid rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        @keyframes bid-bob {
          0%, 100% {
            transform: translateY(0)
              rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)) rotateZ(var(--rz, 0deg));
          }
          50% {
            transform: translateY(-12px)
              rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)) rotateZ(var(--rz, 0deg));
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .bid-float-card {
            animation: none !important;
          }
        }
      `}</style>
    </motion.div>
  );
}
