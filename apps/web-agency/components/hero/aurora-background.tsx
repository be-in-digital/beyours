"use client";

/**
 * AuroraBackground — fond mint en mouvement, contenu DANS la zone hero
 * (pas global) et SANS mix-blend-mode (qui rendait la page "transparente"
 * sur les sections suivantes).
 *
 * - Le wrapper a son propre fond opaque (--background) pour que les
 *   sections du dessous restent lisibles.
 * - Un mask gradient atténue les halos vers le bas pour transitionner
 *   doucement vers la couleur de fond.
 * - prefers-reduced-motion : les animations s'arrêtent.
 */
export function AuroraBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Halo mint warm, en haut-droite */}
      <div className="bid-aurora bid-aurora--warm" />
      {/* Halo mint cool, en bas-gauche */}
      <div className="bid-aurora bid-aurora--cool" />
      {/* Halo mint deep, qui dérive lentement au centre */}
      <div className="bid-aurora bid-aurora--deep" />
      {/* Subtle grid overlay */}
      <div className="bid-grid-overlay" />

      <style>{`
        .bid-aurora {
          position: absolute;
          width: 70vw;
          height: 70vw;
          max-width: 1200px;
          max-height: 1200px;
          border-radius: 9999px;
          filter: blur(140px);
          will-change: transform;
        }
        .bid-aurora--warm {
          top: -25%;
          right: -10%;
          background: radial-gradient(
            circle at 50% 50%,
            rgba(82, 207, 175, 0.30) 0%,
            rgba(82, 207, 175, 0.14) 40%,
            transparent 70%
          );
          opacity: 0.85;
          animation: bid-aurora-drift-1 22s ease-in-out infinite;
        }
        .bid-aurora--cool {
          top: 5%;
          left: -15%;
          background: radial-gradient(
            circle at 50% 50%,
            rgba(57, 145, 122, 0.32) 0%,
            rgba(45, 114, 96, 0.14) 40%,
            transparent 70%
          );
          opacity: 0.7;
          animation: bid-aurora-drift-2 28s ease-in-out infinite;
        }
        .bid-aurora--deep {
          top: 15%;
          left: 25%;
          width: 50vw;
          height: 50vw;
          background: radial-gradient(
            circle at 50% 50%,
            rgba(160, 229, 211, 0.22) 0%,
            transparent 60%
          );
          opacity: 0.65;
          animation: bid-aurora-drift-3 35s ease-in-out infinite;
        }
        .bid-grid-overlay {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(82, 207, 175, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(82, 207, 175, 0.05) 1px, transparent 1px);
          background-size: 80px 80px;
          mask-image: radial-gradient(ellipse 70% 40% at 50% 30%, black 30%, transparent 80%);
          -webkit-mask-image: radial-gradient(ellipse 70% 40% at 50% 30%, black 30%, transparent 80%);
        }

        @keyframes bid-aurora-drift-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-8%, 10%) scale(1.12); }
          66% { transform: translate(6%, -6%) scale(0.94); }
        }
        @keyframes bid-aurora-drift-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(12%, -10%) scale(1.18); }
        }
        @keyframes bid-aurora-drift-3 {
          0%, 100% { transform: translate(0, 0) scale(1) rotate(0deg); }
          50% { transform: translate(-10%, 8%) scale(1.1) rotate(20deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .bid-aurora { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
