"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

interface ContainerScrollProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Scroll-linked 3D reveal wrapper for a hero mockup.
 * As the user scrolls, the inner card tilts forward and scales,
 * giving the impression of a product that emerges into view.
 * Respects prefers-reduced-motion via framer-motion reducedMotion setting
 * at the app level; additionally we clamp transforms to safe values.
 */
export function ContainerScroll({ children, className }: ContainerScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 80%", "end 30%"],
  });

  const rotate = useTransform(scrollYProgress, [0, 0.5], [18, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [0.92, 1]);
  const translate = useTransform(scrollYProgress, [0, 0.5], [-60, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.2], [0.5, 1]);

  return (
    <div
      ref={ref}
      className={cn(
        "relative w-full [perspective:1200px]",
        className
      )}
    >
      <motion.div
        style={{
          rotateX: rotate,
          scale,
          y: translate,
          opacity,
          transformStyle: "preserve-3d",
          transformOrigin: "50% 100%",
        }}
        className="relative will-change-transform"
      >
        {children}
      </motion.div>
    </div>
  );
}
