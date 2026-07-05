"use client";

import dynamic from "next/dynamic";

/**
 * r3f-root-client.tsx — wrapper client pour R3FRoot.
 *
 * Next.js 16 interdit `dynamic({ ssr: false })` dans un Server Component
 * (le root layout est RSC). On contourne via ce wrapper "use client" qui
 * importe R3FRoot dynamiquement, garantissant que Three.js ne s'exécute
 * que côté navigateur.
 */
const R3FRoot = dynamic(
  () => import("./r3f-root").then((m) => m.R3FRoot),
  { ssr: false },
);

export default R3FRoot;
