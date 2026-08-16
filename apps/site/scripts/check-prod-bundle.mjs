#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// check-prod-bundle.mjs — guardrail against a repeat of bug #6
// ─────────────────────────────────────────────────────────────────────────────
//
// NEXT_PUBLIC_* variables are inlined into the bundle at `next build` time.
// This script downloads the production page plus the JS chunks it ACTUALLY
// SERVES and fails (exit 1) if a FORBIDDEN Convex URL shows up in them —
// typically a dead URL (happy-otter-123), a dev deployment, or the emergency
// placeholder (NEXT_PUBLIC_CONVEX_URL missing at build time). The only
// deployment allowed in production is fearless-poodle-133.
//
// Usage:
//   node scripts/check-prod-bundle.mjs
//   node scripts/check-prod-bundle.mjs https://beyours.fr
//   node scripts/check-prod-bundle.mjs https://<preview>.vercel.app
//   LIVE_URL=https://beyours.fr node scripts/check-prod-bundle.mjs
//
// When to run it: AFTER every web-restaurant deployment, and ideally in CI as a
// Vercel post-deploy step. A non-zero exit means block / roll back.
//
// No dependencies: Node >= 18 (global fetch). Tested on Node 20.
// ─────────────────────────────────────────────────────────────────────────────

// The only Convex deployment allowed in prod (team momoseck8 / project wedilybird).
const ALLOWED_CONVEX_SUBDOMAIN = "fearless-poodle-133";

// Subdomains known to have broken production (so we can print a clearer message).
// The failure rule is « subdomain != ALLOWED » either way.
const HARD_BLOCKLIST = ["happy-otter-123"];

const DEFAULT_URL = "https://beyours.fr";
const REQ_TIMEOUT_MS = 15000;
const CHUNK_CONCURRENCY = 8;
const MAX_CHUNKS = 300;
const USER_AGENT = "Mozilla/5.0 beindigital-prod-bundle-check";

const pageUrl = process.argv[2] || process.env.LIVE_URL || DEFAULT_URL;

async function fetchText(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQ_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": USER_AGENT },
    });
    if (!res.ok) return { ok: false, status: res.status, text: "" };
    return { ok: true, status: res.status, text: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

// Collects the URLs of the referenced JS chunks (src="..." and <link href="....js">).
function extractScriptUrls(html, baseUrl) {
  const urls = new Set();
  const re = /(?:src|href)\s*=\s*["']([^"']+?\.js(?:\?[^"']*)?)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      urls.add(new URL(m[1], baseUrl).href);
    } catch {
      /* URL malformée : ignorer */
    }
  }
  return [...urls];
}

// Tous les hosts *.convex.cloud / *.convex.site présents dans un texte.
function findConvexHosts(text) {
  const found = new Set();
  const re = /\b([a-z0-9-]+)\.convex\.(cloud|site)\b/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    found.add(`${m[1].toLowerCase()}.convex.${m[2].toLowerCase()}`);
  }
  return found;
}

const subdomainOf = (host) => host.split(".convex.")[0];

async function mapLimit(items, limit, fn) {
  let i = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (i < items.length) {
        const idx = i++;
        await fn(items[idx]);
      }
    },
  );
  await Promise.all(workers);
}

async function main() {
  console.log(`[check-prod-bundle] page   : ${pageUrl}`);
  console.log(
    `[check-prod-bundle] autorisé : ${ALLOWED_CONVEX_SUBDOMAIN}.convex.{cloud,site}`,
  );

  const page = await fetchText(pageUrl);
  if (!page.ok) {
    console.error(
      `\n✖ Impossible de charger la page (HTTP ${page.status || "??"}). ` +
        `Vérification impossible.`,
    );
    process.exit(1);
  }

  const scriptUrls = extractScriptUrls(page.text, pageUrl).slice(0, MAX_CHUNKS);
  console.log(`[check-prod-bundle] ${scriptUrls.length} chunk(s) JS référencé(s).`);

  // host -> Set(sources où on l'a vu)
  const found = new Map();
  const record = (hosts, source) => {
    for (const h of hosts) {
      if (!found.has(h)) found.set(h, new Set());
      found.get(h).add(source);
    }
  };

  // Le HTML lui-même (scripts inline / payload RSC) + chaque chunk.
  record(findConvexHosts(page.text), "(HTML)");
  await mapLimit(scriptUrls, CHUNK_CONCURRENCY, async (url) => {
    try {
      const chunk = await fetchText(url);
      if (chunk.ok) record(findConvexHosts(chunk.text), url);
    } catch {
      console.warn(`[check-prod-bundle] ! chunk illisible, ignoré : ${url}`);
    }
  });

  if (found.size === 0) {
    console.error(
      "\n✖ Aucune URL *.convex.{cloud,site} trouvée dans le bundle servi.\n" +
        "  Suspect : NEXT_PUBLIC_CONVEX_URL absente au build, page protégée, ou\n" +
        "  chunks non téléchargés. Vérification NON concluante.",
    );
    process.exit(1);
  }

  console.log("\nHosts Convex détectés dans le bundle :");
  for (const [host, sources] of found) {
    const ok = subdomainOf(host) === ALLOWED_CONVEX_SUBDOMAIN;
    const tags = [];
    if (HARD_BLOCKLIST.includes(subdomainOf(host))) tags.push("URL morte connue");
    if (subdomainOf(host) === "placeholder")
      tags.push("fallback = NEXT_PUBLIC_CONVEX_URL absente au build");
    const srcList = [...sources].slice(0, 2).join(", ");
    console.log(
      `  ${ok ? "✓" : "✖"} ${host}` +
        (tags.length ? `  [${tags.join(" ; ")}]` : "") +
        `  (${srcList}${sources.size > 2 ? ", …" : ""})`,
    );
  }

  const forbidden = [...found.keys()].filter(
    (h) => subdomainOf(h) !== ALLOWED_CONVEX_SUBDOMAIN,
  );

  if (forbidden.length > 0) {
    console.error(
      `\n✖ ÉCHEC : URL(s) Convex interdite(s) dans le bundle de prod : ` +
        forbidden.join(", "),
    );
    console.error(
      "  → Le build servi n'est PAS câblé sur le bon déploiement.\n" +
        "  → Corrige NEXT_PUBLIC_CONVEX_URL sur Vercel, puis REBUILD SANS CACHE\n" +
        "    (décocher « Use existing Build Cache »). Un simple redeploy ne suffit pas.",
    );
    process.exit(1);
  }

  console.log(
    `\n✓ OK : le bundle ne référence que ${ALLOWED_CONVEX_SUBDOMAIN}.convex.{cloud,site}.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(`\n✖ Erreur inattendue : ${err?.stack || err}`);
  process.exit(1);
});
