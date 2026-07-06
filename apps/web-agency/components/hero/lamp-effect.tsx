/**
 * LampEffect — version pure CSS (pas de framer-motion, donc 0 JS bundle
 * impact pour cet effet).
 *
 * Couches :
 *   1. Deux cônes mint en conic-gradient qui s'expandent au mount via
 *      animation CSS (forwards), puis pulsent doucement en boucle.
 *   2. La ligne lumineuse au top: 12vh, traversée par un "scan" mint
 *      qui glisse de gauche à droite toutes les 4s — l'effet
 *      "courant qui passe dans le filament".
 *   3. Le halo respire en boucle 7s.
 *   4. Une dizaine de particules mint qui descendent verticalement
 *      dans le faisceau, fade-in / fade-out, durations et delays
 *      randomisés via custom properties → effet "poussière dans la
 *      lumière".
 *   5. Grille mint subtle, masquée en radial ellipse.
 *   6. Vignette verticale finale → transition vers le noir.
 *
 * Aucun mix-blend-mode, aucun coût GPU lourd : seules transform/opacity
 * sont animées. C'est un Server Component (rendu sans JS sur le client).
 */

const PARTICLES = [
  { left: "12%", delay: "0s", duration: "9s" },
  { left: "23%", delay: "1.4s", duration: "11s" },
  { left: "34%", delay: "3.2s", duration: "8s" },
  { left: "44%", delay: "0.8s", duration: "10s" },
  { left: "52%", delay: "2.5s", duration: "12s" },
  { left: "61%", delay: "4.1s", duration: "9s" },
  { left: "72%", delay: "1.9s", duration: "11s" },
  { left: "83%", delay: "3.7s", duration: "10s" },
  { left: "90%", delay: "0.4s", duration: "8s" },
];

export function LampEffect() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[120vh] overflow-hidden"
    >
      {/* ── Cone gauche ───────────────────────────────────────────── */}
      <div className="bid-lamp-cone bid-lamp-cone--left" />
      {/* ── Cone droit ────────────────────────────────────────────── */}
      <div className="bid-lamp-cone bid-lamp-cone--right" />

      {/* ── Ligne lumineuse (la "lamp") avec scan qui glisse ─────── */}
      <div className="bid-lamp-line">
        <span className="bid-lamp-scan" aria-hidden="true" />
      </div>

      {/* ── Halo radial qui pulse derrière la ligne ─────────────── */}
      <div className="bid-lamp-halo" />

      {/* ── Particules mint qui descendent dans le faisceau ─────── */}
      <div className="bid-lamp-particles">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="bid-lamp-particle"
            style={
              {
                left: p.left,
                animationDelay: p.delay,
                animationDuration: p.duration,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* ── Grille subtle ───────────────────────────────────────── */}
      <div className="bid-lamp-grid" />

      {/* ── Vignette de transition ─────────────────────────────── */}
      <div className="bid-lamp-vignette" />

      <style>{`
        .bid-lamp-cone {
          position: absolute;
          top: 0;
          height: 60vh;
          /* Largeur finale fixée (était animée width: 12rem -> 30rem,
             ce qui pouvait être détecté comme layout shift sur les
             enfants positionnés autour). On utilise transform: scaleX
             à la place — transform n'affecte jamais le layout, donc
             zéro impact CLS. */
          width: 30rem;
          background: conic-gradient(
            from 70deg at top center,
            rgba(82, 207, 175, 0.55),
            rgba(82, 207, 175, 0.18),
            transparent 50%
          );
          filter: blur(70px);
          opacity: 0;
          transform-origin: top center;
          will-change: opacity, transform;
          animation:
            bid-cone-enter 1.4s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards,
            bid-cone-pulse 5s ease-in-out 1.6s infinite;
        }
        .bid-lamp-cone--left {
          right: 50%;
          transform-origin: top right;
        }
        .bid-lamp-cone--right {
          left: 50%;
          transform-origin: top left;
          background: conic-gradient(
            from 290deg at top center,
            transparent 50%,
            rgba(82, 207, 175, 0.18),
            rgba(82, 207, 175, 0.55)
          );
        }
        @keyframes bid-cone-enter {
          0% { opacity: 0; transform: scaleX(0.4); }
          100% { opacity: 1; transform: scaleX(1); }
        }
        @keyframes bid-cone-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }

        .bid-lamp-line {
          position: absolute;
          top: 12vh;
          left: 50%;
          height: 2px;
          /* width fixé pour éviter le CLS, expansion via transform: scaleX */
          width: 32rem;
          max-width: 92vw;
          overflow: hidden;
          opacity: 0;
          background: linear-gradient(
            to right,
            transparent 0%,
            rgba(82, 207, 175, 0.9) 30%,
            rgba(160, 229, 211, 1) 50%,
            rgba(82, 207, 175, 0.9) 70%,
            transparent 100%
          );
          box-shadow:
            0 0 24px rgba(82, 207, 175, 0.55),
            0 0 80px rgba(82, 207, 175, 0.25);
          border-radius: 2px;
          will-change: opacity, transform;
          transform-origin: center;
          transform: translateX(-50%) scaleX(0.2);
          animation: bid-lamp-line-enter 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.5s forwards;
        }
        @keyframes bid-lamp-line-enter {
          0% { opacity: 0; transform: translateX(-50%) scaleX(0.2); }
          100% { opacity: 1; transform: translateX(-50%) scaleX(1); }
        }
        .bid-lamp-scan {
          position: absolute;
          top: 0;
          left: -30%;
          width: 30%;
          height: 100%;
          background: linear-gradient(
            to right,
            transparent 0%,
            rgba(255, 255, 255, 0.8) 50%,
            transparent 100%
          );
          animation: bid-lamp-scan 4.5s ease-in-out 1.7s infinite;
          will-change: transform;
        }
        @keyframes bid-lamp-scan {
          0% { transform: translateX(0); }
          55% { transform: translateX(450%); }
          100% { transform: translateX(450%); }
        }

        .bid-lamp-halo {
          position: absolute;
          top: 0;
          left: 50%;
          width: 70rem;
          height: 35rem;
          max-width: 130vw;
          transform: translateX(-50%);
          background: radial-gradient(
            ellipse at top,
            rgba(82, 207, 175, 0.32) 0%,
            rgba(82, 207, 175, 0.12) 25%,
            transparent 60%
          );
          filter: blur(20px);
          animation: bid-lamp-breathe 7s ease-in-out infinite;
          will-change: opacity, transform;
        }
        @keyframes bid-lamp-breathe {
          0%, 100% {
            opacity: 0.85;
            transform: translateX(-50%) scale(1);
          }
          50% {
            opacity: 1;
            transform: translateX(-50%) scale(1.06);
          }
        }

        .bid-lamp-particles {
          position: absolute;
          top: 12vh;
          left: 50%;
          transform: translateX(-50%);
          width: 60vw;
          max-width: 60rem;
          height: 70vh;
          pointer-events: none;
        }
        .bid-lamp-particle {
          position: absolute;
          top: 0;
          width: 2px;
          height: 2px;
          border-radius: 9999px;
          background: rgba(160, 229, 211, 0.9);
          box-shadow: 0 0 8px rgba(160, 229, 211, 0.7);
          animation-name: bid-lamp-particle-fall;
          animation-iteration-count: infinite;
          animation-timing-function: linear;
          will-change: transform, opacity;
        }
        @keyframes bid-lamp-particle-fall {
          0% {
            transform: translateY(0);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 0.6;
          }
          100% {
            transform: translateY(70vh);
            opacity: 0;
          }
        }

        .bid-lamp-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(82, 207, 175, 0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(82, 207, 175, 0.045) 1px, transparent 1px);
          background-size: 64px 64px;
          mask-image: radial-gradient(ellipse 60% 50% at 50% 30%, black 0%, transparent 70%);
          -webkit-mask-image: radial-gradient(ellipse 60% 50% at 50% 30%, black 0%, transparent 70%);
        }

        .bid-lamp-vignette {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to bottom,
            transparent 0%,
            transparent 60%,
            rgba(9, 9, 9, 0.6) 85%,
            #090909 100%
          );
        }

        @media (prefers-reduced-motion: reduce) {
          .bid-lamp-cone {
            animation: none !important;
            opacity: 1;
            width: 30rem;
          }
          .bid-lamp-line {
            animation: none !important;
            opacity: 1;
            width: 32rem;
          }
          .bid-lamp-scan,
          .bid-lamp-halo,
          .bid-lamp-particle {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
