"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface RevealTextProps {
  text: string;
  className?: string;
  stagger?: number;
  delay?: number;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  splitBy?: "word" | "char";
}

/**
 * Animated text that reveals word-by-word or char-by-char.
 * Uses pure Framer Motion (no split-type external dependency needed at runtime).
 */
export function RevealText({
  text,
  className,
  stagger = 0.05,
  delay = 0,
  as: Tag = "span",
  splitBy = "word",
}: RevealTextProps) {
  const ref = useRef<HTMLElement | null>(null);

  const parts =
    splitBy === "word" ? text.split(/(\s+)/) : Array.from(text);

  const container = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: stagger,
        delayChildren: delay,
      },
    },
  };

  const child = {
    hidden: { opacity: 0, y: "0.4em", filter: "blur(8px)" },
    visible: {
      opacity: 1,
      y: "0em",
      filter: "blur(0px)",
      transition: {
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
      },
    },
  };

  const MotionTag = motion[Tag] as typeof motion.span;

  return (
    <MotionTag
      ref={ref as React.RefObject<HTMLSpanElement>}
      className={cn("inline-block", className)}
      variants={container}
      initial="hidden"
      animate="visible"
      aria-label={text}
    >
      {parts.map((part, i) => {
        if (splitBy === "word" && /^\s+$/.test(part)) {
          return <span key={i}>{part}</span>;
        }
        return (
          <motion.span
            key={i}
            variants={child}
            className="inline-block whitespace-pre"
            aria-hidden="true"
          >
            {part}
          </motion.span>
        );
      })}
    </MotionTag>
  );
}
