"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

/* ═══════════════════════════════════════════════
   Carte à gratter — jouable, autonome (canvas destination-out)
   Le vernis se gratte réellement au doigt / à la souris. Révélation
   automatique à ~50 % gratté, ou via le bouton « Tout révéler ».
   ═══════════════════════════════════════════════ */

export function ScratchCard({
  won,
  prizeLabel,
  onRevealed,
}: {
  won: boolean;
  prizeLabel: string;
  onRevealed: () => void;
}) {
  const reduce = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const drawing = useRef(false);
  const moveCount = useRef(0);
  const revealedRef = useRef(false);
  const [revealed, setRevealed] = useState(false);

  const symbols = won ? ["🎁", "🎁", "🎁"] : ["🍋", "🔔", "⭐"];

  const paintFoil = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#b8bcc6");
    grad.addColorStop(0.3, "#e8eaf0");
    grad.addColorStop(0.5, "#9aa0ab");
    grad.addColorStop(0.72, "#dfe2e8");
    grad.addColorStop(1, "#a7abb5");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Grain métallique
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle =
        Math.random() > 0.5
          ? "rgba(255,255,255,0.16)"
          : "rgba(60,64,72,0.12)";
      ctx.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4);
    }

    // Texte gravé
    ctx.fillStyle = "rgba(70,74,82,0.85)";
    ctx.font =
      "700 18px var(--font-display), system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("GRATTEZ ICI", w / 2, h / 2 - 8);
    ctx.font = "500 11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(70,74,82,0.6)";
    ctx.fillText("du doigt ou à la souris", w / 2, h / 2 + 14);
  }, []);

  const reveal = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    setRevealed(true);
    onRevealed();
  }, [onRevealed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    canvas.width = wrap.clientWidth;
    canvas.height = wrap.clientHeight;
    paintFoil(canvas);
  }, [paintFoil]);

  function scratchAt(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 24, 0, Math.PI * 2);
    ctx.fill();

    moveCount.current += 1;
    if (moveCount.current % 5 === 0) checkProgress(ctx, canvas);
  }

  function checkProgress(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
  ) {
    const { width, height } = canvas;
    const data = ctx.getImageData(0, 0, width, height).data;
    let cleared = 0;
    let total = 0;
    for (let i = 3; i < data.length; i += 4 * 40) {
      total++;
      if ((data[i] ?? 255) < 128) cleared++;
    }
    if (total > 0 && cleared / total > 0.5) reveal();
  }

  return (
    <div className="mx-auto w-full max-w-[340px]">
      <div
        ref={wrapRef}
        className="relative h-[190px] w-full overflow-hidden rounded-2xl border border-[color:var(--border)] shadow-[0_18px_40px_-22px_rgba(112,60,34,0.5)]"
        style={{ touchAction: "none" }}
      >
        {/* Contenu révélé (dessous) */}
        <div
          className="absolute inset-0 grid place-items-center"
          style={{
            background:
              "radial-gradient(120% 120% at 50% 0%, #fff8ef, #f4ecdf)",
          }}
        >
          <div className="flex flex-col items-center px-4 text-center">
            <div className="flex items-center gap-3 text-4xl">
              {symbols.map((s, i) => (
                <motion.span
                  key={i}
                  initial={reduce ? false : { rotateY: 90, opacity: 0 }}
                  animate={
                    revealed ? { rotateY: 0, opacity: 1 } : undefined
                  }
                  transition={{ delay: 0.12 * i, duration: 0.5 }}
                >
                  {s}
                </motion.span>
              ))}
            </div>
            <p
              className={`mt-3 font-display text-lg font-bold ${won ? "text-primary" : "text-muted-foreground"}`}
            >
              {won ? prizeLabel : "Pas cette fois…"}
            </p>
          </div>
        </div>

        {/* Vernis (canvas) */}
        <motion.canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full cursor-pointer"
          animate={{ opacity: revealed ? 0 : 1 }}
          transition={{ duration: 0.6 }}
          style={{ pointerEvents: revealed ? "none" : "auto" }}
          onPointerDown={(e) => {
            if (revealed) return;
            drawing.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            scratchAt(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (!drawing.current || revealed) return;
            scratchAt(e.clientX, e.clientY);
          }}
          onPointerUp={() => {
            drawing.current = false;
          }}
          onPointerLeave={() => {
            drawing.current = false;
          }}
        />
      </div>

      {!revealed && (
        <button
          type="button"
          onClick={reveal}
          className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-[color:var(--border)] bg-surface-1 px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          Tout révéler
        </button>
      )}
    </div>
  );
}
