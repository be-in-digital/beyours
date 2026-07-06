import { httpRouter } from "convex/server";

import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

/**
 * HTTP router Convex — endpoints publics accessibles via
 * `<deployment>.convex.site/<path>`.
 *
 * `/api/contact` (POST)
 *   Réception du formulaire de contact. Hash l'IP server-side
 *   (SHA-256(salt + ip)) puis appelle la mutation interne
 *   `contactForms.submitContact` qui persiste + schedule l'email.
 *
 *   CORS strict sur 3 origines : prod, www, localhost dev.
 *   Honeypot field accepté mais flagué côté mutation (pas d'erreur 4xx
 *   pour ne pas signaler aux bots qu'ils ont été détectés).
 */
const ALLOWED_ORIGINS = new Set<string>([
  "https://beindigital.fr",
  "https://www.beindigital.fr",
  "http://localhost:3001",
]);

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function hashIp(ip: string): Promise<string> {
  const salt = process.env.IP_HASH_SALT ?? "";
  if (!salt) {
    // Sans salt configuré, on log un avertissement et on hash quand même
    // pour ne pas casser le form. À setter via `convex env set IP_HASH_SALT`.
    console.warn(
      "[http] IP_HASH_SALT non configurée — hash sans salt. Run `pnpx convex env set IP_HASH_SALT <hex>`.",
    );
  }
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function extractIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    // x-forwarded-for peut contenir plusieurs IP séparées par virgule
    // (chaîne de proxies). La première est toujours l'IP client.
    const first = xff.split(",")[0];
    if (first) return first.trim();
  }
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

const submitContactHandler = httpAction(async (ctx, request) => {
  const origin = request.headers.get("origin");
  const baseHeaders = corsHeaders(origin);

  // Preflight CORS
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: baseHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      { ok: false, error: "Method not allowed" },
      { status: 405, headers: baseHeaders },
    );
  }

  let payload: {
    name?: unknown;
    email?: unknown;
    message?: unknown;
    honeypot?: unknown;
  };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(
      { ok: false, error: "JSON invalide" },
      { status: 400, headers: baseHeaders },
    );
  }

  const name = typeof payload.name === "string" ? payload.name : "";
  const email = typeof payload.email === "string" ? payload.email : "";
  const message = typeof payload.message === "string" ? payload.message : "";
  const honeypot =
    typeof payload.honeypot === "string" ? payload.honeypot : undefined;

  if (!name.trim() || !email.includes("@") || !message.trim()) {
    return jsonResponse(
      { ok: false, error: "Champs invalides" },
      { status: 400, headers: baseHeaders },
    );
  }

  const ip = extractIp(request.headers);
  const ipHashed = await hashIp(ip);

  try {
    await ctx.runMutation(internal.contactForms.submitContact, {
      name,
      email,
      message,
      honeypot,
      ipHashed,
    });
  } catch (err) {
    console.error("[http] submitContact failed", err);
    return jsonResponse(
      { ok: false, error: "Erreur côté serveur" },
      { status: 500, headers: baseHeaders },
    );
  }

  return jsonResponse({ ok: true }, { status: 200, headers: baseHeaders });
});

const http = httpRouter();

http.route({
  path: "/api/contact",
  method: "POST",
  handler: submitContactHandler,
});

http.route({
  path: "/api/contact",
  method: "OPTIONS",
  handler: submitContactHandler,
});

export default http;
