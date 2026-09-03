#!/usr/bin/env node
/**
 * Turns `pnpm audit --json` into the paragraph a human needs at 3 a.m.
 *
 * The nightly audit already existed and already worked: it went red at 07:22 on
 * 02/09/2026, two hours before the same advisory surfaced on somebody's feature
 * branch and cost two duplicate pull requests. What it did not do was say
 * anything a passer-by could act on — the run was a red dot in a tab nobody
 * opens, and the fix was rediscovered twice from scratch.
 *
 * So this prints, per advisory: what it is, what it reaches, and the exact
 * `pnpm.overrides` line that closes it — the same shape as the twenty-two
 * already in package.json, because that is how every one of these has been
 * fixed here.
 *
 * Usage: node .github/scripts/audit-summary.mjs <audit.json> [--min-severity=high]
 */

import { readFileSync } from "node:fs"

const RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 }

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith("--"))
const minArg = args.find((a) => a.startsWith("--min-severity="))
const min = RANK[minArg?.split("=")[1] ?? "high"] ?? RANK.high

if (!file) {
  console.error("usage: audit-summary.mjs <audit.json> [--min-severity=high]")
  process.exit(2)
}

let report
try {
  report = JSON.parse(readFileSync(file, "utf8"))
} catch (error) {
  // A malformed report must not be the reason nobody hears about the advisory.
  console.log("## Audit\n")
  console.log(`Le rapport JSON n'a pas pu être lu (\`${error.message}\`).`)
  console.log("Le verdict reste celui de l'étape précédente : rouge.")
  process.exit(0)
}

const advisories = Object.values(report.advisories ?? {})
const gated = advisories.filter((a) => (RANK[a.severity] ?? 0) >= min)
const below = advisories.length - gated.length

/**
 * The floor an override has to clear.
 *
 * `patched_versions` is a range (`>=3.1.6`, `>=1.2.3 <2.0.0`). What the fix
 * needs is its lowest admissible version, which is the first one written down.
 */
function floorOf(patched) {
  const m = /(\d+\.\d+\.\d+[^\s|]*)/.exec(patched ?? "")
  return m?.[1] ?? null
}

/**
 * Compares two `x.y.z` floors. Prereleases sort below their own release, which
 * is the answer that matters here: a floor of `3.0.0-rc.1` must not win over
 * `3.0.0`.
 */
function higher(a, b) {
  if (!a) return b
  if (!b) return a
  const parts = (v) => v.split("-")[0].split(".").map(Number)
  const [pa, pb] = [parts(a), parts(b)]
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0) ? a : b
  }
  const pre = (v) => v.includes("-")
  if (pre(a) !== pre(b)) return pre(a) ? b : a
  return a
}

/** The shortest path is the one that explains the presence in the fewest words. */
function shortestPath(advisory) {
  const paths = advisory.findings?.flatMap((f) => f.paths ?? []) ?? []
  if (paths.length === 0) return null
  return paths.slice().sort((a, b) => a.length - b.length)[0]
}

console.log("## Ce qui est rouge, et ce qui le fermerait\n")

if (gated.length === 0) {
  console.log("Aucun avis au niveau `high` ou `critical` dans ce rapport.")
  if (below > 0) console.log(`\n${below} avis en dessous du seuil, non bloquants.`)
  process.exit(0)
}

/**
 * One line per package, not per advisory.
 *
 * Two advisories on the same package are the normal case — `fast-uri` arrived
 * as four on one day — and they resolve to a single override at the highest of
 * their floors. Emitting one line each produced a duplicate JSON key, which is
 * exactly the mistake that had to be undone by hand when two branches fixed
 * `browserslist` in parallel.
 */
const floors = new Map()
for (const a of gated) {
  const floor = floorOf(a.patched_versions)
  const id = a.github_advisory_id ?? a.url?.split("/").pop() ?? a.id
  console.log(`### ${a.module_name} — ${a.severity}\n`)
  console.log(`- **${a.title}**`)
  console.log(`- ${id} · vulnérable \`${a.vulnerable_versions}\` · corrigé \`${a.patched_versions}\``)
  const path = shortestPath(a)
  if (path) console.log(`- Chemin le plus court : \`${path}\``)
  if (a.url) console.log(`- ${a.url}`)
  console.log("")
  if (floor) floors.set(a.module_name, higher(floors.get(a.module_name), floor))
  else console.log(`> Pas de version corrigée exploitable dans \`${a.patched_versions}\` — à traiter à la main.\n`)
}

const lines = [...floors].map(([mod, floor]) => `      "${mod}@<${floor}": "^${floor}",`)

if (lines.length > 0) {
  console.log("### À ajouter dans `pnpm.overrides` de `package.json`\n")
  console.log("```json")
  console.log(lines.join("\n"))
  console.log("```\n")
  console.log(
    "Puis `pnpm install` pour bouger le lockfile, et `pnpm audit --prod --audit-level high` " +
      "pour vérifier la sortie 0. Un override déjà présent qu'un nouvel avis a dépassé se " +
      "corrige en relevant son plancher, pas en ajoutant une seconde entrée.",
  )
}

if (below > 0) console.log(`\n_${below} avis sous le seuil, non bloquants._`)
