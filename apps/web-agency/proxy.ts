import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

/**
 * proxy.ts — Next.js 16 a remplacé `middleware.ts` par `proxy.ts`
 * (cf. Decision Log #25, doc Next 16). Il n'y a qu'UNE fonction proxy par app,
 * donc on FUSIONNE ici deux responsabilités :
 *
 *   1. Auth back-office (Convex Auth) — redirections sur `/back-office`.
 *      ⚠️ UX uniquement : la doc Next recommande de ne PAS se reposer sur le
 *      proxy pour la sécurité (un prefetch peut le contourner). Le vrai verrou
 *      est `authz.requireBackOfficeAccess` dans CHAQUE fonction Convex.
 *   2. CSP + headers sécurité du site (logique inchangée vs l'ancien proxy —
 *      site public majoritairement statique → CSP sans nonce pour rester
 *      cachable au CDN). Voir la note "Static vs Dynamic Rendering with CSP".
 *
 * Runtime : nodejs (non configurable en Next 16).
 */

/**
 * Origine du widget de chat Be in Digital (AI Business OS). Le loader
 * `widget.js` et l'iframe de conversation sont servis depuis ce domaine,
 * il doit donc être whitelisté en script-src ET frame-src.
 */
const WIDGET_ORIGIN = "https://aibusinessos.beindigital.fr";

/** Back-office (auth requise). `/back-office/signin` est l'exception publique. */
const isBackOffice = createRouteMatcher(["/back-office(.*)"]);
const isSignIn = createRouteMatcher(["/back-office/signin"]);

/**
 * CSP + headers sécurité — logique identique à l'ancien proxy, isolée dans une
 * fonction pour être renvoyée depuis le handler Convex Auth.
 */
function securityResponse(request: NextRequest): NextResponse {
  const isDev = process.env.NODE_ENV === "development";

  // Sanity Studio est une SPA tierce qui requiert `unsafe-eval` (JIT-compiled
  // schema deserializer) et se connecte à plusieurs domaines Sanity.
  const isStudio = request.nextUrl.pathname.startsWith("/studio");

  const scriptSrc = isStudio
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://core.sanity-cdn.com https://cdn.sanity.io`
    : `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${WIDGET_ORIGIN}`;

  const connectSrc = isStudio
    ? `connect-src 'self' https://*.sanity.io https://*.api.sanity.io wss://*.api.sanity.io https://cdn.sanity.io https://core.sanity-cdn.com https://*.sanity-cdn.com`
    : `connect-src 'self' https:`;

  const frameSrc = isStudio
    ? `frame-src 'self' https://*.sanity.io https://core.sanity-cdn.com`
    : `frame-src 'self' ${WIDGET_ORIGIN}`;

  const cspDirectives = [
    `default-src 'self'`,
    scriptSrc,
    `style-src 'self' 'unsafe-inline'`,
    `style-src-attr 'unsafe-inline'`,
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

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), accelerometer=()",
  );
  response.headers.set("X-Frame-Options", isStudio ? "SAMEORIGIN" : "DENY");

  return response;
}

/**
 * Proxy fusionné. Le middleware Convex Auth gère le refresh de token et expose
 * `convexAuth.isAuthenticated()`. Pour un visiteur anonyme (aucun cookie auth)
 * c'est un quasi no-op → la réponse publique reste cachable.
 */
export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    const authed = await convexAuth.isAuthenticated();

    // Non connecté sur le back-office (hors page de connexion) → connexion.
    if (isBackOffice(request) && !isSignIn(request) && !authed) {
      return nextjsMiddlewareRedirect(request, "/back-office/signin");
    }
    // Déjà connecté sur la page de connexion → dashboard.
    if (isSignIn(request) && authed) {
      return nextjsMiddlewareRedirect(request, "/back-office");
    }

    // Toutes les autres réponses portent le CSP + headers sécurité.
    return securityResponse(request);
  },
  { convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL },
);

export const config = {
  /**
   * Match toutes les routes SAUF assets statiques / metadata / prefetch
   * (recommandé par la doc Next 16 pour ne pas rallonger les prefetch).
   * Couvre `/back-office/*` ET `/api/auth/*` (routes Convex Auth côté Next).
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
