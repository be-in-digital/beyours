"use client";

import { motion, type Variants, type HTMLMotionProps } from "framer-motion";

/* ═══════════════════════════════════════════════
   Reusable animation components
   ═══════════════════════════════════════════════

   Usage:
     <FadeIn>content</FadeIn>
     <FadeIn direction="up" delay={0.2}>content</FadeIn>
     <StaggerContainer>
       <FadeIn>item 1</FadeIn>
       <FadeIn>item 2</FadeIn>
     </StaggerContainer>
     <ScaleIn>content</ScaleIn>
   ═══════════════════════════════════════════════ */

// ── Shared defaults ──

// Reveal as soon as the element approaches the viewport (small bottom margin
// only). A symmetric -20% margin left whole sections invisible during fast
// scrolls — the content only appeared once well inside the screen.
const defaultViewport = { once: true, margin: "0px 0px -10% 0px" as const };
const defaultTransition = { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };

// ── FadeIn ──

type Direction = "up" | "down" | "left" | "right" | "none";

interface FadeInProps extends Omit<HTMLMotionProps<"div">, "initial" | "whileInView" | "viewport"> {
  direction?: Direction;
  delay?: number;
  duration?: number;
  distance?: number;
  children: React.ReactNode;
}

const directionOffset: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: 40 },
  down: { x: 0, y: -40 },
  left: { x: 40, y: 0 },
  right: { x: -40, y: 0 },
  none: { x: 0, y: 0 },
};

export function FadeIn({
  direction = "up",
  delay = 0,
  duration = 0.6,
  distance,
  children,
  ...props
}: FadeInProps) {
  const offset = directionOffset[direction];
  const d = distance ?? 1;

  return (
    <motion.div
      initial={{ opacity: 0, x: offset.x * d, y: offset.y * d }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={defaultViewport}
      transition={{ ...defaultTransition, duration, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ── StaggerContainer ──

interface StaggerContainerProps extends Omit<HTMLMotionProps<"div">, "initial" | "whileInView" | "viewport"> {
  stagger?: number;
  delay?: number;
  children: React.ReactNode;
}

export function StaggerContainer({
  stagger = 0.1,
  delay = 0,
  children,
  ...props
}: StaggerContainerProps) {
  const variants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: stagger,
        delayChildren: delay,
      },
    },
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={defaultViewport}
      variants={variants}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ── StaggerItem (child of StaggerContainer) ──

interface StaggerItemProps extends Omit<HTMLMotionProps<"div">, "variants"> {
  direction?: Direction;
  distance?: number;
  children: React.ReactNode;
}

export function StaggerItem({
  direction = "up",
  distance,
  children,
  ...props
}: StaggerItemProps) {
  const offset = directionOffset[direction];
  const d = distance ?? 1;

  const variants: Variants = {
    hidden: { opacity: 0, x: offset.x * d, y: offset.y * d },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: defaultTransition,
    },
  };

  return (
    <motion.div variants={variants} {...props}>
      {children}
    </motion.div>
  );
}

// ── ScaleIn ──

interface ScaleInProps extends Omit<HTMLMotionProps<"div">, "initial" | "whileInView" | "viewport"> {
  delay?: number;
  duration?: number;
  children: React.ReactNode;
}

export function ScaleIn({
  delay = 0,
  duration = 0.6,
  children,
  ...props
}: ScaleInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={defaultViewport}
      transition={{ ...defaultTransition, duration, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ── BlurIn ──

interface BlurInProps extends Omit<HTMLMotionProps<"div">, "initial" | "whileInView" | "viewport"> {
  delay?: number;
  duration?: number;
  children: React.ReactNode;
}

export function BlurIn({
  delay = 0,
  duration = 0.7,
  children,
  ...props
}: BlurInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, filter: "blur(0px)" }}
      viewport={defaultViewport}
      transition={{ ...defaultTransition, duration, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
