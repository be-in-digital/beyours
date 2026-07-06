/**
 * AnimatedTitle — H1 hero avec gradient mint qui se déplace lentement
 * sur le segment italique, et reveal mot-par-mot au mount.
 *
 * IMPORTANT : c'est le LCP candidate de la home. Pour cette raison :
 *   - C'est un Server Component (pas de "use client", pas de framer-motion)
 *   - Toutes les animations sont CSS pures avec animation-delay
 *   - Le H1 est rendu visible direct par le SSR (pas d'hydratation
 *     requise pour qu'il soit peint)
 *   - prefers-reduced-motion : skip animation, texte direct
 *
 * Reçoit deux strings depuis Sanity (homePage.hero) :
 *  - prefix : la partie en couleur foreground neutre
 *  - gradient : la partie italique + gradient mint
 */
import { Fragment } from "react";

type Props = { prefix: string; gradient: string };

const STAGGER_MS = 80;
const START_DELAY_MS = 200;

export function AnimatedTitle({ prefix, gradient }: Props) {
  const prefixWords = prefix.split(/\s+/).filter(Boolean);
  const gradientWords = gradient.split(/\s+/).filter(Boolean);

  // Index global pour le stagger (mots prefix + mots gradient)
  let wordIndex = 0;

  return (
    <h1 className="font-display text-foreground mx-auto max-w-[18ch] text-center text-5xl leading-[1.0] font-light tracking-tight sm:text-7xl lg:text-[6.5rem] xl:text-[7.5rem]">
      {prefixWords.map((word, i) => {
        const delay = START_DELAY_MS + wordIndex++ * STAGGER_MS;
        return (
          <Fragment key={`p-${i}`}>
            <span
              className="bid-hero-word"
              style={{ animationDelay: `${delay}ms` }}
            >
              {word}
            </span>{" "}
          </Fragment>
        );
      })}
      <span className="italic">
        {gradientWords.map((word, i) => {
          const delay = START_DELAY_MS + wordIndex++ * STAGGER_MS;
          return (
            <Fragment key={`g-${i}`}>
              <span
                className="bid-hero-word bid-gradient-text"
                style={{ animationDelay: `${delay}ms` }}
              >
                {word}
              </span>
              {i < gradientWords.length - 1 ? " " : null}
            </Fragment>
          );
        })}
      </span>
      <style>{`
        .bid-hero-word {
          display: inline-block;
          /* IMPORTANT pour le LCP : on n'utilise PAS opacity:0 ici. Le H1
             est rendu peint dès le 1er paint navigateur (LCP candidate
             mesurable). L'effet d'entrée est un *léger* slide-up + un
             fade-in subtil (0.6 → 1). Le navigateur considère opacity
             >= 0.5 comme "rendu" pour le LCP donc on commence à 0.6. */
          animation: bid-hero-word-in 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
          will-change: opacity, transform;
        }
        @keyframes bid-hero-word-in {
          0% {
            opacity: 0.6;
            transform: translateY(0.4em);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .bid-gradient-text {
          /* Gradient resserré sur des tons mint plus saturés (300-500 de la
             palette) — les pastels 100/200 disparaissaient sur le halo
             central du LampEffect.
             IMPORTANT : on applique gradient + clip directement sur chaque
             span de mot (pas sur un wrapper parent). Sinon les enfants animés
             créent leur propre stacking context via transform, ce qui
             empêche le background-clip:text du parent de clipper leurs
             glyphes — le texte devient invisible et n'apparaît qu'à la
             sélection. */
          background: linear-gradient(
            120deg,
            #52CFAF 0%,
            #7DDBC3 30%,
            #52CFAF 50%,
            #A0E5D3 70%,
            #52CFAF 100%
          );
          background-size: 220% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          -webkit-text-fill-color: transparent;
          /* Combine l'animation d'entrée (slide-up de .bid-hero-word) avec
             le shift de gradient continu — sinon cette règle écraserait
             l'entry animation puisque les deux classes coexistent. */
          animation:
            bid-hero-word-in 0.7s cubic-bezier(0.16, 1, 0.3, 1) both,
            bid-gradient-shift 6s ease-in-out infinite;
        }
        @keyframes bid-gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .bid-hero-word {
            animation: none;
            opacity: 1;
            transform: none;
          }
          .bid-gradient-text {
            animation: none;
          }
        }
      `}</style>
    </h1>
  );
}
