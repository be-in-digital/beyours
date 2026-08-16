#!/usr/bin/env node
/**
 * Publication de `apps/themes` vers le dépôt miroir de distribution
 * `be-in-digital/beyours-boilerplate`, d'où les sites clients sont clonés.
 *
 * Pourquoi un miroir. Un client ne peut pas cloner un sous-dossier de
 * monorepo : git clone des dépôts entiers. Le miroir est la découpe
 * livrable — le même code, mais consommable seul.
 *
 * Ce que la traversée doit corriger, sous peine de casser `beyours create` :
 *
 *   1. Les dépendances moteur sont en `workspace:^` ici. Hors workspace,
 *      pnpm ne sait pas les résoudre. → versions publiées sur le registre.
 *   2. Le monorepo n'a qu'un lockfile, à sa racine. Un dépôt client en a
 *      besoin d'un à lui, sinon `--frozen-lockfile` échoue en CI. → généré.
 *   3. `vercel.json` porte un `turbo-ignore` : il n'y a pas de workspace
 *      turbo chez le client. → retiré.
 *   4. Le nom du paquet est `@beyours/themes`, scopé au monorepo.
 *      → `beyours-boilerplate`.
 *
 * Ces quatre points ne sont pas théoriques : la première synchronisation, faite
 * à la main le 16/08/2026, les a tous manqués et a rendu le miroir
 * ininstallable pendant vingt minutes.
 *
 * Les versions viennent du REGISTRE, pas de packages/*\/package.json : seul le
 * registre dit ce qu'un client peut réellement installer. Un paquet dont le
 * changeset n'est pas encore publié resterait sinon introuvable.
 *
 * L'historique du miroir est préservé — commit ordinaire par-dessus, jamais de
 * force-push. Chaque site client a un remote `template` qui pointe dessus et
 * fait des merges : réécrire l'historique casserait `pnpm update:template`
 * chez tout le monde.
 *
 * Usage :
 *   node scripts/publish-mirror.mjs --check   # dry-run, exit 1 s'il y a dérive
 *   node scripts/publish-mirror.mjs           # synchronise et pousse
 *
 * Auth : NODE_AUTH_TOKEN (lecture du registre) et, pour pousser,
 * MIRROR_PUSH_TOKEN — un PAT `contents:write` sur beyours-boilerplate.
 */

import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const SOURCE = join(ROOT, "apps/themes")
const MIRROR_REPO = "be-in-digital/beyours-boilerplate"
const MIRROR_PKG_NAME = "beyours-boilerplate"
const REGISTRY = "https://npm.pkg.github.com"

/** Jamais transmis au miroir : n'a de sens que dans le monorepo. */
const NOT_SHIPPED = ["vercel.json", ".turbo", "tsconfig.tsbuildinfo"]

/** Jamais écrasé côté miroir : lui appartient, ou est régénéré. */
const MIRROR_OWNED = [".git", "node_modules", ".next", "pnpm-lock.yaml", "next-env.d.ts"]

/**
 * Le miroir est reconstruit intégralement à chaque passage (rsync --delete) :
 * un commit fait directement dessus disparaît à la synchronisation suivante.
 * Le bandeau le dit là où quelqu'un le lira — en tête du README.
 */
const MIRROR_README_BANNER = `<!-- Généré automatiquement — ne pas éditer ici. -->

> ⚠️ **Dépôt généré.** Son contenu est produit depuis \`apps/themes\` du monorepo
> [beyours-engine](https://github.com/${MIRROR_REPO.split("/")[0]}/beyours-engine)
> et remplacé intégralement à chaque synchronisation. **Un commit fait
> directement ici sera perdu** — les modifications se font dans le monorepo.
>
> Ce dépôt existe parce qu'un site client ne peut pas cloner un sous-dossier de
> monorepo : c'est la découpe livrable, avec les paquets moteur en versions
> publiées et son propre lockfile.

`

const check = process.argv.includes("--check")

// `stdio: "inherit"` fait renvoyer null à execFileSync — d'où le ?? "".
const run = (cmd, args, opts = {}) =>
  (execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }) ?? "").trim()

const log = (msg) => console.log(msg)
const fail = (msg) => {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

// ---------------------------------------------------------------------------
// 1. Versions publiées
// ---------------------------------------------------------------------------

function publishedVersion(pkg) {
  try {
    return run("npm", ["view", pkg, "version", `--registry=${REGISTRY}`])
  } catch {
    return null
  }
}

function resolveVersions(deps) {
  const engineDeps = Object.keys(deps).filter((k) => k.startsWith("@be-in-digital/"))
  const resolved = {}
  for (const pkg of engineDeps) {
    const v = publishedVersion(pkg)
    if (!v) fail(`${pkg} est introuvable sur ${REGISTRY}. NODE_AUTH_TOKEN est-il posé, et le paquet publié ?`)
    resolved[pkg] = `^${v}`
  }
  return resolved
}

// ---------------------------------------------------------------------------
// 2. Transformation du package.json
// ---------------------------------------------------------------------------

function mirrorPackageJson(sourcePkgPath, versions) {
  const pkg = JSON.parse(readFileSync(sourcePkgPath, "utf8"))
  pkg.name = MIRROR_PKG_NAME
  for (const [dep, range] of Object.entries(versions)) {
    pkg.dependencies[dep] = range
  }
  const stillWorkspace = Object.entries(pkg.dependencies)
    .filter(([, v]) => String(v).startsWith("workspace:"))
    .map(([k]) => k)
  if (stillWorkspace.length) {
    fail(`dépendances encore en workspace: ${stillWorkspace.join(", ")}`)
  }
  return JSON.stringify(pkg, null, 2) + "\n"
}

// ---------------------------------------------------------------------------
// 3. Synchronisation
// ---------------------------------------------------------------------------

if (!existsSync(SOURCE)) fail(`source introuvable : ${SOURCE}`)

const pushToken = process.env.MIRROR_PUSH_TOKEN
if (!check && !pushToken) {
  fail("MIRROR_PUSH_TOKEN absent — impossible de pousser. Relancer avec --check pour un dry-run.")
}

const work = mkdtempSync(join(tmpdir(), "beyours-mirror-"))
const clone = join(work, "mirror")

try {
  const remote = pushToken
    ? `https://x-access-token:${pushToken}@github.com/${MIRROR_REPO}.git`
    : `https://github.com/${MIRROR_REPO}.git`

  log(`→ clone de ${MIRROR_REPO}`)
  run("git", ["clone", "--depth", "1", remote, clone])

  log("→ résolution des versions publiées")
  const sourcePkg = JSON.parse(readFileSync(join(SOURCE, "package.json"), "utf8"))
  const versions = resolveVersions(sourcePkg.dependencies)
  for (const [pkg, range] of Object.entries(versions)) log(`   ${pkg} → ${range}`)

  log("→ copie du contenu")
  const excludes = [...NOT_SHIPPED, ...MIRROR_OWNED].flatMap((e) => ["--exclude", e])
  run("rsync", ["-a", "--delete", ...excludes, `${SOURCE}/`, `${clone}/`])

  log("→ réécriture du package.json")
  writeFileSync(join(clone, "package.json"), mirrorPackageJson(join(SOURCE, "package.json"), versions))

  log("→ bandeau « dépôt généré » en tête du README")
  const readme = join(clone, "README.md")
  if (existsSync(readme)) {
    writeFileSync(readme, MIRROR_README_BANNER + readFileSync(readme, "utf8"))
  }

  log("→ mise à jour du lockfile")
  run("pnpm", ["install", "--lockfile-only", "--ignore-scripts"], { cwd: clone, stdio: "inherit" })

  const status = run("git", ["status", "--porcelain"], { cwd: clone })
  if (!status) {
    log("✓ le miroir est déjà à jour")
    process.exit(0)
  }

  const changed = status.split("\n").length
  log(`→ ${changed} fichier(s) à publier`)

  if (check) {
    log(run("git", ["status", "--short"], { cwd: clone }))
    fail("dérive détectée entre apps/themes et le miroir (mode --check)")
  }

  const sha = run("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT })
  const subject = run("git", ["log", "-1", "--format=%s"], { cwd: ROOT })

  run("git", ["config", "user.name", "beyours-bot"], { cwd: clone })
  run("git", ["config", "user.email", "bot@beyours.fr"], { cwd: clone })
  run("git", ["add", "-A"], { cwd: clone })
  run("git", ["commit", "-m", `chore: synchronisation depuis apps/themes (${sha})\n\n${subject}`], { cwd: clone })
  run("git", ["push", "origin", "HEAD:main"], { cwd: clone })

  log(`✓ miroir publié — ${MIRROR_REPO}`)
} finally {
  rmSync(work, { recursive: true, force: true })
}
