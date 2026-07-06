import { NextResponse, type NextRequest } from "next/server";

/**
 * proxy.ts — Next.js 16 a remplacé `middleware.ts` par `proxy.ts`
 * (cf. Decision Log #25, doc Next 16).
 *
 * Responsabilités :
 *   1. CSP sans nonce (compatible SSG/ISR + caching CDN)
 *   2. Headers sécurité : HSTS, X-Content-Type-Options, Referrer-Policy,
 *      Permissions-Policy, X-Frame-Options
 *   3. Studio Sanity = CSP relaxée (SPA tierce embarquée)
 *
 * Pourquoi pas de nonce ?
 *   La doc Next.js 16 explique qu'utiliser un nonce force tout le site à
 *   être *dynamiquement* rendu (impossible de cacher au CDN). Pour un
 *   site marketing essentiellement statique (SSG + ISR sur /work/[slug]),
 *   on perd ~80% du gain perf. Le compromis sécurité est acceptable :
 *   sources whitelistées + 'unsafe-inline' uniquement sur les inline
 *   scripts d'init Next (signés par Next, donc surface XSS minime).
 *   Voir https://nextjs.org/docs/app/guides/content-security-policy
 *   "Static vs Dynamic Rendering with CSP".
 *
 * Runtime : nodejs (non configurable en Next 16).
 */

/**
 * Origine du widget de chat Be in Digital (AI Business OS). Le loader
 * `widget.js` et l'iframe de conversation sont servis depuis ce domaine,
 * il doit donc être whitelisté en script-src ET frame-src (sinon la CSP
 * bloque la bulle). Les appels réseau du widget passent par connect-src,
 * déjà ouvert à `https:` sur le site public.
 */
const WIDGET_ORIGIN = "https://aibusinessos.beindigital.fr";

export function proxy(request: NextRequest) {
  const isDev = process.env.NODE_ENV === "development";

  // Sanity Studio est une SPA tierce qui requiert `unsafe-eval` (JIT-compiled
  // schema deserializer) et se connecte à plusieurs domaines Sanity.
  // On relâche la CSP pour /studio uniquement — le site public garde une
  // policy stricte basée sur des sources whitelistées.
  const isStudio = request.nextUrl.pathname.startsWith("/studio");

  const scriptSrc = isStudio
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://core.sanity-cdn.com https://cdn.sanity.io`
    : // Site public : 'unsafe-inline' uniquement pour les inline scripts d'init
      // de Next (signés, surface attack minime). 'unsafe-eval' uniquement en
      // dev (React DevTools). + widget de chat Be in Digital.
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${WIDGET_ORIGIN}`;

  const connectSrc = isStudio
    ? `connect-src 'self' https://*.sanity.io https://*.api.sanity.io wss://*.api.sanity.io https://cdn.sanity.io https://core.sanity-cdn.com https://*.sanity-cdn.com`
    : // Convex (form contact) + Sanity (live preview / fetch) sont sur
      // des sous-domaines variés ; on accepte tous les https en connect-src.
      `connect-src 'self' https:`;

  const frameSrc = isStudio
    ? `frame-src 'self' https://*.sanity.io https://core.sanity-cdn.com`
    : // Site public : iframe de conversation du widget de chat.
      `frame-src 'self' ${WIDGET_ORIGIN}`;

  const cspDirectives = [
    `default-src 'self'`,
    scriptSrc,
    // Modern apps with runtime animations (R3F, NumberFlow, GSAP, Lenis,
    // notre TextReveal) injectent des <style> blocks et écrivent
    // element.style. On accepte 'unsafe-inline' pour styles uniquement
    // (surface XSS bien plus petite que pour scripts).
    `style-src 'self' 'unsafe-inline'`,
    `style-src-attr 'unsafe-inline'`,
    // cdn.sanity.io explicite pour les covers case studies + medias
    `img-src 'self' blob: data: https://cdn.sanity.io https:`,
    `font-src 'self' data:`,
    `worker-src 'self' blob:`,
    connectSrc,
    frameSrc,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    isStudio ? `frame-ancestors 'self'` : `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ];

  const csp = cspDirectives.join("; ");

  const response = NextResponse.next();

  // CSP sur la réponse — c'est ici que le navigateur l'applique
  response.headers.set("Content-Security-Policy", csp);

  // HSTS preload — domaine apex uniquement (pas de subdomain include car
  // restaurant.beindigital.fr est servi par une autre app)
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );

  // Anti-MIME sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Referrer policy : pas de fuite de path en cross-origin
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions policy : tout désactivé par défaut, opt-in si besoin
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), accelerometer=()",
  );

  // X-Frame-Options redondant avec frame-ancestors mais hérité legacy.
  // Studio doit pouvoir s'embarquer dans son propre iframe → SAMEORIGIN.
  response.headers.set(
    "X-Frame-Options",
    isStudio ? "SAMEORIGIN" : "DENY",
  );

  return response;
}

export const config = {
  /**
   * Match toutes les routes SAUF :
   * - assets statiques (_next/static, _next/image, favicon, etc.)
   * - fichiers .well-known
   * - prefetch (next-router-prefetch / purpose:prefetch headers)
   *
   * Recommandé par la doc Next 16 pour ne pas rallonger les prefetch.
   */
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.well-known).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
