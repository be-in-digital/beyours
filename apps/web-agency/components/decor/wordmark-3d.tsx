"use client";

import { Suspense, lazy, useEffect, useState } from "react";

/**
 * Wordmark3D — décor signature : "BE IN DIGITAL" extrudé en 3D mint,
 * tilté en perspective, qui flotte derrière le manifesto.
 *
 * Lecture : la marque devient un objet sculptural — référence Igloo Inc.,
 * Tonik, Locomotive Saga. Plus puissant qu'une géométrie abstraite parce
 * que c'est la marque elle-même qui *prend forme*.
 *
 * Le canvas est lazy-loaded post-LCP pour ne pas peser sur le bundle
 * initial. La font typeface JSON est servie depuis /fonts/.
 */
const Wordmark3DCanvas = lazy(() =>
  import("./wordmark-3d-canvas").then((m) => ({ default: m.Wordmark3DCanvas })),
);

export function Wordmark3D({ className }: { className?: string }) {
  const [shouldMount, setShouldMount] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShouldMount(true), 700);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none ${className ?? ""}`}
    >
      {/* Halo mint diffus en arrière-fond pour ancrer le wordmark */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(82, 207, 175, 0.18) 0%, transparent 65%)",
          filter: "blur(40px)",
        }}
      />
      {shouldMount ? (
        <Suspense fallback={null}>
          <Wordmark3DCanvas />
        </Suspense>
      ) : null}
    </div>
  );
}
