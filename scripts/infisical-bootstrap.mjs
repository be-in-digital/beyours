#!/usr/bin/env node
/**
 * Builds and audits the Infisical store that holds this repo's environment.
 *
 * The goal is a single place the tests, the builds and local development all
 * read from, instead of the current spread: values live in Convex deployment
 * envs, in Vercel, in GitHub Secrets and in whatever `.env.local` each laptop
 * happens to have. `tasks/secret-rotation-runbook.md` §A.3 is the map of that
 * spread, and the reason rotating one credential is a manual sweep.
 *
 * WHAT THIS SCRIPT NEVER DOES: print, log or store a secret VALUE. It works on
 * key names only. `check` pipes the Infisical export through a key extractor
 * and throws the values away unread; `plan` prints commands for you to run, it
 * does not run them. Values travel from where they are today straight into
 * Infisical, on your machine, under your login.
 *
 * Usage:
 *   node scripts/infisical-bootstrap.mjs folders  --env=dev
 *   node scripts/infisical-bootstrap.mjs check    --env=dev [--scope=reference]
 *   node scripts/infisical-bootstrap.mjs plan     [--scope=reference]
 *   node scripts/infisical-bootstrap.mjs migrate  --scope=site --from-convex=<name> [--apply]
 *   node scripts/infisical-bootstrap.mjs migrate  --scope=site --from-file=<dotenv> [--apply]
 *   node scripts/infisical-bootstrap.mjs seed     --env=dev [--scope=site] [--apply]
 *   node scripts/infisical-bootstrap.mjs run      --scope=site -- pnpm dev:site
 *   node scripts/infisical-bootstrap.mjs scopes
 *
 * Requires the Infisical CLI and INFISICAL_PROJECT_ID (see
 * apps/docs/deployment/infisical.md). `folders` and `check` also need you to be
 * logged in (`infisical login`) or to have INFISICAL_TOKEN set.
 *
 * `check` answers in its exit code, and the two failures are different things:
 * 0 complete · 1 the store answered and is missing keys · 2 usage · 3 the store
 * or the session is down. `.github/workflows/env-store-health.yml` reads them.
 */

import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import crypto from "node:crypto"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")

/**
 * One folder per environment surface the repo actually has. The `spec` files
 * are the source of truth for which keys belong where — they are committed,
 * reviewed, and already carry the "required / optional / feature group"
 * annotations, so this script never holds a second copy of the list that could
 * rot.
 */
const SCOPES = {
  platform: {
    path: "/platform",
    label: "BeYours' own credentials — identical on every deployment",
    specs: ["packages/core/.env.example"],
    // packages/core does not know about these: they are read by Convex actions
    // in the apps, but the account behind them is BeYours', not the client's.
    // See the ownership table in apps/docs/deployment/infisical.md.
    add: [
      "UBER_DIRECT_WEBHOOK_SECRET",
      "STRIPE_BID_SECRET_KEY",
      "STRIPE_BID_WEBHOOK_SECRET",
      "STRIPE_BID_PRICE_MAINTENANCE",
      // The six Auto Blog plan prices. `bidSubscription.ts` reads all seven
      // STRIPE_BID_PRICE_* names — `buildPriceMap` for the webhook, which turns
      // a Stripe price back into a plan, and `resolvePriceIdFromPlan` for
      // checkout — and only _MAINTENANCE was ever written down. So `migrate`
      // filed the other six under "in no spec, NOT PUSHED", `check` never
      // reported them missing, and the paid Auto Blog tier could not be
      // provisioned through this chain at all. Same Stripe account as the rest
      // of the BID block: BeYours' own, not the restaurant's.
      "STRIPE_BID_PRICE_STARTER",
      "STRIPE_BID_PRICE_PRO",
      "STRIPE_BID_PRICE_ENTERPRISE",
      "STRIPE_BID_PRICE_STARTER_ANNUAL",
      "STRIPE_BID_PRICE_PRO_ANNUAL",
      "STRIPE_BID_PRICE_ENTERPRISE_ANNUAL",
      "BID_NOTIFY_EMAIL",
    ],
  },
  site: {
    path: "/site",
    label: "apps/site — the commercial site (beyours.fr)",
    specs: ["apps/site/.env.example"],
  },
  reference: {
    path: "/reference",
    label: "apps/reference — the engine bench, what CI builds and e2e-tests",
    specs: ["apps/reference/.env.example"],
  },
  demo: {
    path: "/demo",
    label: "the shared demo instance — one backend for every template's demo",
    // Same variable surface as any themes instance: a demo IS a themes
    // deployment, it just happens to be the only one BeYours runs itself.
    // Separate from /themes on purpose — /themes holds the DEFAULTS a client
    // clone starts from, this holds one running environment's real values.
    specs: ["apps/themes/.env.example", "apps/themes/.env.convex.example"],
  },
  themes: {
    path: "/themes",
    label: "apps/themes — template defaults, Next side + Convex side",
    specs: ["apps/themes/.env.example", "apps/themes/.env.convex.example"],
  },
}

/**
 * Variables a deployment owns, that no SHARED folder should ever hold and that
 * nothing may copy from one deployment to another.
 *
 * Two families, one rule.
 *
 * `@convex-dev/auth` generates JWT_PRIVATE_KEY and JWKS with its own CLI and
 * writes them straight onto the deployment; the auth server reads them and no
 * application code ever names them. So they are invisible to grep, they look
 * exactly like orphans in an audit, and they are the one pair you must not
 * remove — without them nobody can sign in.
 *
 * The other five are the ones `GENERATORS` below knows how to mint: a random
 * value whose only correct scope is the single backend it was minted for. The
 * ownership table in apps/docs/deployment/infisical.md has always said so, and
 * until the 4 Sep 2026 audit nothing enforced it: `/themes` was found holding
 * generated secrets among the 17 keys `setup-convex-env.sh --infisical` would
 * have pushed onto every client deployment provisioned from that folder. Two
 * restaurants sharing one ENCRYPTION_KEY means either one's leak decrypts the
 * other's stored OAuth tokens.
 *
 * Enforced in three places, because the chain has three links: `migrate` never
 * pushes one INTO the store, `check` reports one found in a shared folder, and
 * `setup-convex-env.sh` never pushes one OUT of the store onto a deployment.
 * That last copy of the list lives inside `apps/themes`, which is cloned to
 * clients where this file does not exist; `setup-convex-env.test.mjs` holds the
 * two together.
 */
const DEPLOYMENT_OWNED = new Set([
  "JWT_PRIVATE_KEY",
  "JWKS",
  "BETTER_AUTH_SECRET",
  "EMAIL_API_SECRET",
  "ENCRYPTION_KEY",
  "ADMIN_BOOTSTRAP_TOKEN",
  "SEED_PASSWORD",
])

/**
 * Folders whose values are DEFAULTS or SHARED credentials, never one running
 * backend's own. `/reference`, `/site` and `/demo` are each a single real
 * environment and are entitled to their own generated secrets; `/platform` is
 * copied to every deployment by definition, and `/themes` is what a client
 * clone starts from — a generated secret in either is one secret for everybody.
 */
const SHARED_FOLDERS = new Set(["/platform", "/themes"])

/**
 * Exit codes, because two failures of `check` need two answers.
 *
 * "The store cannot be reached" and "the store answered, and it is missing
 * keys" were both exit 1, so the daily health workflow could not tell an
 * Infisical outage from the long-standing fact that some folders are not filled
 * in yet. One is an incident, the other is a backlog item; collapsing them
 * means either paging on the backlog or sleeping through the incident.
 *
 * Read by .github/workflows/env-store-health.yml. Keep them in step.
 */
const EXIT_OK = 0
const EXIT_INCOMPLETE = 1 // the store answered; its contents are not what the specs say
const EXIT_USAGE = 2 // bad flags — a mistake in the command, not in the store
const EXIT_STORE_DOWN = 3 // no CLI, no session, or a folder that would not read

/* ── argument handling ───────────────────────────────────────────────────── */

const argv = process.argv.slice(2)
const command = argv.find((a) => !a.startsWith("--"))
const flag = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const ENV = flag("env", "dev")
const ONLY = flag("scope")
/**
 * The BeYours platform project. Not a secret — it identifies a project, it does
 * not open one; reading anything still needs a session or a machine identity.
 * Committed so that `pnpm dev` reaches the store after `infisical login` alone,
 * with nothing to remember. Override with INFISICAL_PROJECT_ID.
 */
const DEFAULT_PROJECT_ID = "da164dca-75e2-4646-b302-5b2274b2b285"
const PROJECT_ID = process.env.INFISICAL_PROJECT_ID || DEFAULT_PROJECT_ID

const scopeNames = ONLY ? [ONLY] : Object.keys(SCOPES)
for (const name of scopeNames) {
  if (!SCOPES[name]) {
    console.error(`Unknown scope "${name}". Known: ${Object.keys(SCOPES).join(", ")}`)
    process.exit(EXIT_USAGE)
  }
}

/* ── reading the specs ───────────────────────────────────────────────────── */

/** Every KEY= line of a .env.example, in order, without the values. */
function keysOfSpec(rel) {
  const file = path.join(ROOT, rel)
  if (!fs.existsSync(file)) return []
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.match(/^([A-Z_][A-Z0-9_]*)=/))
    .filter(Boolean)
    .map((m) => m[1])
}

function expectedKeys(name) {
  const scope = SCOPES[name]
  const keys = new Set()
  for (const spec of scope.specs) for (const k of keysOfSpec(spec)) keys.add(k)
  for (const k of scope.add ?? []) keys.add(k)
  return [...keys].sort()
}

/* ── talking to Infisical ────────────────────────────────────────────────── */

/** CLI present, project id set, and a session that can actually read. */
function storeReachable() {
  if (!PROJECT_ID) return false
  try {
    execFileSync("infisical", ["--version"], { stdio: "ignore" })
  } catch {
    return false
  }
  return storedKeys("/").error !== "auth"
}

function requireCli() {
  try {
    execFileSync("infisical", ["--version"], { stdio: "ignore" })
  } catch {
    console.error("The Infisical CLI is not on PATH.")
    console.error("  brew install infisical/get-cli/infisical")
    process.exit(EXIT_STORE_DOWN)
  }
}

/**
 * The names currently stored at a path. The export carries values; they are
 * matched away line by line and never held, printed or returned.
 *
 * Returns { keys } or { error } — the error is classified rather than shown
 * raw, because the CLI's own answer to "no session" is to start an interactive
 * login flow, which in a script reads as an unhelpful failure on stdin. Every
 * caller runs with stdin closed so that prompt dies immediately instead of
 * hanging a CI job.
 */
function storedKeys(folderPath) {
  let out
  try {
    out = execFileSync(
      "infisical",
      ["export", "--format=dotenv", `--projectId=${PROJECT_ID}`, `--env=${ENV}`, `--path=${folderPath}`],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, INFISICAL_DISABLE_UPDATE_CHECK: "true" },
      },
    )
  } catch (e) {
    const err = String(e.stderr ?? "") + String(e.stdout ?? "") + String(e.message ?? "")
    if (/login session|unauthori[sz]ed|401|authentication/i.test(err)) return { error: "auth" }
    if (/folder|not found|404/i.test(err)) return { error: "missing" }
    return { error: err.trim().split("\n").filter(Boolean).pop()?.slice(0, 140) || "unknown" }
  }
  const keys = out
    .split("\n")
    .map((l) => l.match(/^(?:export\s+)?([A-Z_][A-Z0-9_]*)=/))
    .filter(Boolean)
    .map((m) => m[1])
  out = null
  return { keys: keys.sort() }
}

const AUTH_HELP = [
  "No Infisical session.",
  "",
  "  infisical login                 # opens a browser, for a person",
  "  export INFISICAL_TOKEN=$(infisical login --method=universal-auth \\",
  "    --client-id=… --client-secret=… --silent --plain)   # for a machine",
  "",
  "See apps/docs/deployment/infisical.md.",
].join("\n")

/* ── commands ────────────────────────────────────────────────────────────── */

function cmdScopes() {
  for (const name of scopeNames) {
    const keys = expectedKeys(name)
    console.log(`\n${SCOPES[name].path}  (${keys.length} keys) — ${SCOPES[name].label}`)
    console.log(`  ${keys.join(", ")}`)
  }
  console.log()
}

function cmdFolders() {
  requireCli()
  for (const name of scopeNames) {
    const folder = SCOPES[name].path.replace(/^\//, "")
    try {
      execFileSync(
        "infisical",
        ["secrets", "folders", "create", `--projectId=${PROJECT_ID}`, `--env=${ENV}`, "--path=/", `--name=${folder}`],
        { stdio: ["ignore", "ignore", "pipe"] },
      )
      console.log(`  created /${folder}`)
    } catch (e) {
      const msg = String(e.stderr ?? "") + String(e.message ?? "")
      if (/login session|unauthori[sz]ed|401|authentication/i.test(msg)) {
        console.log()
        console.log(AUTH_HELP)
        process.exitCode = EXIT_STORE_DOWN
        return
      }
      if (/exist/i.test(msg)) console.log(`  /${folder} already there`)
      else console.error(`  FAILED /${folder}: ${msg.trim().split("\n")[0] || "unknown"}`)
    }
  }
}

/**
 * The documentation makes folder claims in prose — "`X` in `/folder`" — and
 * prose does not type-check. `apps/docs/deployment/infisical.md` told operators
 * for months to put `SENTRY_*` in `/platform`, which the spec has never
 * accepted, so `check` reported three keys "not in any spec" into the daily job
 * summary every morning and the folder never reported `complete`.
 *
 * The spec is derived from the committed `.env.example` files and is the only
 * source of truth. So a claim in the doc is checkable against it, cheaply, with
 * no store and no network — which is the point: this runs even when Infisical
 * is down, and it runs BEFORE requireCli() for exactly that reason.
 *
 * Narrow, but not blind to a rewording — which is what it was.
 *
 * The rule was one pattern: a backticked env-var name followed by "in
 * `/folder`". Anything else a person would naturally write —
 * "put `SENTRY_*` into `/platform`", "`SENTRY_*` goes to `/platform`",
 * "`/platform` holds no `SENTRY_*` key" — was invisible to it, and the guard
 * then reported "0 folder claim(s) checked" and exited 0. A checker that
 * reports zero is indistinguishable from a document with nothing to check, and
 * this one was in the second state while claiming to be a guard against the
 * first.
 *
 * So: two directions, each with the verbs the document actually uses.
 *
 *  - KEY-FIRST — "`X` in/into/under `/folder`", or with a verb between them.
 *  - FOLDER-FIRST — "`/folder` holds/carries/contains `X`", which is how the
 *    document states the SENTRY correction it was written about.
 *
 * A folder-first sentence may be a NEGATIVE claim ("holds no `SENTRY_*` key"),
 * and negating it flips what the spec must say: the key must be ABSENT. Read as
 * a positive claim it would fail on a document that is telling the truth, which
 * is the way a guard gets deleted.
 *
 * Still narrow on both axes: the name must be backticked and shouty-case, the
 * folder must be one this script knows, and the two must be within a short
 * distance on one line with no sentence boundary between them.
 */
const DOC_REL = "apps/docs/deployment/infisical.md"

/** "`SENTRY_DSN` in `/platform`", and the verbs a writer reaches for instead. */
const DOC_CLAIM_KEY_FIRST =
  /`([A-Z][A-Z0-9_]*\*?)`[^.\n]{0,40}?\b(?:in|into|under|to|on)\b[^.\n]{0,12}?`(\/[a-z]+)`/g

/** "`/platform` holds no `SENTRY_*` key" — the shape the doc actually uses. */
const DOC_CLAIM_FOLDER_FIRST =
  /`(\/[a-z]+)`[^.\n]{0,20}?\b(holds|carries|contains|declares|lists)\b\s*(no\s+)?[^.\n]{0,12}?`([A-Z][A-Z0-9_]*\*?)`/g

/**
 * Blank out `~~struck~~` spans, preserving every newline so line numbers still
 * point at the real line.
 *
 * A document has to be able to record a retraction, and the honest way to
 * retract a folder claim is to strike it and say why. Without this, quoting the
 * wrong claim in order to correct it reads exactly like making it — the guard
 * stayed red on the very edit that fixed the defect. Strikethrough is the one
 * marker that means "this is no longer asserted", so it is the one thing the
 * scanner skips.
 */
function stripStruck(text) {
  return text.replace(/~~[\s\S]*?~~/g, (m) => m.replace(/[^\n]/g, " "))
}

function docFolderClaims() {
  const file = path.join(ROOT, DOC_REL)
  if (!fs.existsSync(file)) return []
  const lines = stripStruck(fs.readFileSync(file, "utf8")).split("\n")
  const claims = []
  const known = (folderPath) => Object.values(SCOPES).some((s) => s.path === folderPath)

  lines.forEach((line, i) => {
    for (const m of line.matchAll(DOC_CLAIM_KEY_FIRST)) {
      if (known(m[2])) claims.push({ line: i + 1, name: m[1], path: m[2], negated: false })
    }
    for (const m of line.matchAll(DOC_CLAIM_FOLDER_FIRST)) {
      if (known(m[1])) {
        claims.push({ line: i + 1, name: m[4], path: m[1], negated: Boolean(m[3]) })
      }
    }
  })

  // One sentence can match both directions — "`/platform` holds no `SENTRY_*`
  // key, and `SENTRY_*` in `/site` instead" — and the same claim counted twice
  // reads as two. Keyed on what the claim IS, not on where it was found.
  const seen = new Set()
  return claims.filter((c) => {
    const key = `${c.line}:${c.path}:${c.name}:${c.negated}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * One line of prose, read as folder claims. The pure half of `docFolderClaims`,
 * so it can be proved without a document.
 */
function claimsInLine(line) {
  const found = []
  const known = (folderPath) => Object.values(SCOPES).some((s) => s.path === folderPath)
  for (const m of line.matchAll(DOC_CLAIM_KEY_FIRST)) {
    if (known(m[2])) found.push({ name: m[1], path: m[2], negated: false })
  }
  for (const m of line.matchAll(DOC_CLAIM_FOLDER_FIRST)) {
    if (known(m[1])) found.push({ name: m[4], path: m[1], negated: Boolean(m[3]) })
  }
  return found
}

/**
 * The phrasings this guard must see, and the prose it must not read as a claim.
 *
 * It runs on every invocation, for the reason `check-commit-attribution.mjs`
 * self-tests: the whole guard is two regular expressions, and a regular
 * expression that stops matching does not fail — it reports zero and exits 0.
 * That is exactly the state this was found in. "0 folder claim(s) checked" is
 * what a document with nothing to check looks like AND what a blind scanner
 * looks like, so the scanner has to prove it can still see.
 */
const CLAIM_SELF_TEST = [
  ["`SENTRY_DSN` in `/platform`", 1],
  ["put `SENTRY_DSN` into `/platform` before the first deploy", 1],
  ["`STRIPE_SECRET_KEY` belongs in `/site`", 1],
  ["`STRIPE_SECRET_KEY` goes to `/site`", 1],
  ["`AWS_REGION` lives under `/themes`", 1],
  // Folder-first, which is how the document states the correction this guard
  // was written about — and which the original pattern could not see at all.
  ["`/platform` holds no `SENTRY_DSN` key, by design", 1],
  ["`/site` carries `STRIPE_SECRET_KEY`", 1],
  ["`/themes` contains `AWS_REGION`", 1],
  // Not claims. A guard that reads these as claims cries wolf and gets deleted.
  ["`ci.yml`'s build job reads `/platform`, behind `INFISICAL_ENABLED`", 0],
  ["There was a fifth folder, `/ci`, holding the names GitHub Actions read.", 0],
  ["`/platform` is 18 keys", 0],
  // A folder this script does not know is not a claim about anything.
  ["`SENTRY_DSN` in `/nowhere`", 0],
]

/** Which self-test cases the patterns currently get wrong. Empty is the only good answer. */
function claimSelfTestFailures() {
  const broken = []
  for (const [line, expected] of CLAIM_SELF_TEST) {
    const found = claimsInLine(line).length
    if (found !== expected) broken.push(`${JSON.stringify(line)} — expected ${expected}, found ${found}`)
  }
  // And the negation must survive the round trip, or "holds no X" is checked
  // as "holds X" and the guard fails a document that is telling the truth.
  const negated = claimsInLine("`/platform` holds no `SENTRY_DSN` key")[0]
  if (!negated?.negated) broken.push("a `holds no` claim is not being read as negated")
  return broken
}

/** Prints every doc claim the spec does not support. Returns how many. */
function checkDocClaims() {
  const broken = claimSelfTestFailures()
  if (broken.length) {
    console.error(`${DOC_REL}: the claim scanner itself is broken — ${broken.length} self-test failure(s).`)
    for (const failure of broken) console.error(`  ${failure}`)
    console.error("  DOC_CLAIM_KEY_FIRST / DOC_CLAIM_FOLDER_FIRST no longer detect what they were written for.")
    console.error()
    process.exit(EXIT_INCOMPLETE)
  }

  const claims = docFolderClaims()
  const bad = []
  for (const c of claims) {
    const scopeName = Object.keys(SCOPES).find((n) => SCOPES[n].path === c.path)
    const keys = expectedKeys(scopeName)
    const present = c.name.endsWith("*")
      ? keys.some((k) => k.startsWith(c.name.slice(0, -1)))
      : keys.includes(c.name)
    // "holds no X" is satisfied by the key being ABSENT.
    if (present === c.negated) bad.push({ ...c, scopeName })
  }
  console.log(`${DOC_REL}: ${claims.length} folder claim(s) checked against the spec`)
  for (const b of bad) {
    const spec = `${SCOPES[b.scopeName].specs.join(", ")}${SCOPES[b.scopeName].add ? " + its add: list" : ""}`
    if (b.negated) {
      console.log(`  WRONG  ${DOC_REL}:${b.line} — says ${b.path} holds no \`${b.name}\`,`)
      console.log(`         but ${b.path}'s spec (${spec}) declares it.`)
      console.log(`         The document is telling operators to leave out a key the folder needs.`)
    } else {
      console.log(`  WRONG  ${DOC_REL}:${b.line} — sends \`${b.name}\` to ${b.path},`)
      console.log(`         but ${b.path}'s spec (${spec}) declares no such key.`)
      console.log(`         An operator who follows the doc gets it reported as "not in any spec".`)
    }
  }
  if (!bad.length && claims.length) console.log("  every claim matches the spec")
  console.log()
  return bad.length
}

function cmdDoc() {
  if (checkDocClaims()) {
    console.error("The documentation disagrees with the spec. Fix one of them.")
    process.exit(EXIT_INCOMPLETE)
  }
}

function cmdCheck() {
  // Before requireCli(): this half needs no store, and a store outage must not
  // hide a documentation defect that is checkable from the repo alone.
  checkDocClaims()
  requireCli()
  let incomplete = 0
  let unreachable = 0
  let leaked = 0

  // Read /platform once. A BeYours-owned key is not missing from /ci just
  // because it lives where it belongs: the workflows load /platform and then
  // the scope's own folder, two steps, so the consumer really does get it.
  const platformKeys = new Set(expectedKeys("platform"))
  const platformStored = new Set(storedKeys(SCOPES.platform.path).keys ?? [])

  for (const name of scopeNames) {
    const scope = SCOPES[name]
    // A shared folder is not expected to HOLD a per-deployment secret — it is
    // expected not to. Its spec still lists five of them, because the spec
    // describes what a deployment needs, so leaving them in `want` would have
    // `check` demand the very keys the block below refuses.
    const want = SHARED_FOLDERS.has(scope.path)
      ? expectedKeys(name).filter((k) => !DEPLOYMENT_OWNED.has(k))
      : expectedKeys(name)
    const { keys: have, error } = storedKeys(scope.path)
    console.log(`\n${scope.path}  (${ENV})`)
    if (error === "auth") {
      console.log()
      console.log(AUTH_HELP)
      process.exitCode = EXIT_STORE_DOWN
      return
    }
    if (error) {
      // A folder nobody created yet is a gap in the store's contents; anything
      // else that would not read is the store, or the session, being down.
      if (error === "missing") {
        incomplete++
        console.log(`  folder missing — run: node scripts/infisical-bootstrap.mjs folders --env=${ENV}`)
      } else {
        unreachable++
        console.log(`  unreadable: ${error}`)
      }
      continue
    }
    const viaPlatform =
      name === "platform" ? [] : want.filter((k) => !have.includes(k) && platformStored.has(k))
    const missing = want.filter((k) => !have.includes(k) && !viaPlatform.includes(k))
    // A BeYours-owned key is never "extra" wherever it turns up. Reporting the
    // shared set as strays in every folder would bury the ones that are.
    // Nor is a per-deployment secret merely "extra" — the block below has a
    // much sharper thing to say about it, and reporting it twice under two
    // headings reads as two problems.
    const extra = have.filter(
      (k) => !want.includes(k) && !platformKeys.has(k) && !DEPLOYMENT_OWNED.has(k),
    )
    // A per-deployment secret sitting in a folder that is copied to everybody.
    // It reads as "complete" by every other measure here — the key is in the
    // spec, the folder holds it — which is exactly why it went unnoticed until
    // an audit ran a dry push and read the names back.
    const shared = SHARED_FOLDERS.has(scope.path)
      ? have.filter((k) => DEPLOYMENT_OWNED.has(k))
      : []
    console.log(
      `  ${have.length} stored, ${want.length} expected` +
        (viaPlatform.length ? `, ${viaPlatform.length} supplied by /platform` : ""),
    )
    if (missing.length) {
      incomplete++
      console.log(`  MISSING (${missing.length}):`)
      for (const k of missing) console.log(`    - ${k}`)
    }
    if (shared.length) {
      leaked++
      console.log(`  MUST NOT BE HERE (${shared.length}) — generated per deployment:`)
      for (const k of shared) console.log(`    - ${k}`)
      console.log(`  ${scope.path} is copied to every deployment that reads it, so one`)
      console.log("  value here is one value for everybody. setup-convex-env.sh refuses")
      console.log("  to push them, so nothing is propagating today — but delete them,")
      console.log("  and generate each deployment's own with `seed` against its folder.")
    }
    if (!missing.length && !extra.length && !shared.length) console.log("  complete")
    else if (extra.length) console.log(`  not in any spec (${extra.length}): ${extra.join(", ")}`)
  }
  console.log()
  // Down beats incomplete: a folder that would not answer cannot be judged
  // complete or otherwise, so reporting "incomplete" for it would be a guess.
  if (unreachable) {
    console.log(`${unreachable} scope(s) unreadable — the store or the session is down.`)
    process.exitCode = EXIT_STORE_DOWN
  } else if (incomplete || leaked) {
    if (incomplete) console.log(`${incomplete} scope(s) incomplete. \`plan\` prints how to fill them.`)
    if (leaked) console.log(`${leaked} shared folder(s) hold a per-deployment secret. Delete them.`)
    process.exitCode = EXIT_INCOMPLETE
  } else {
    process.exitCode = EXIT_OK
  }
}

function cmdPlan() {
  console.log(`
How the values get there. Run these yourself — nothing here is executed for
you, and no value is ever printed by this script.

Values live in two places today, so there are two moves.

1. Convex deployment envs — the biggest half.

     npx convex env list --prod > /tmp/from-convex.env      # or --deployment <name>
     chmod 600 /tmp/from-convex.env
     infisical secrets set --file=/tmp/from-convex.env \\
       --projectId=$INFISICAL_PROJECT_ID --env=${ENV} --path=/reference
     rm -f /tmp/from-convex.env

   Check the file before pushing: it is the one moment the values sit in
   plaintext on disk. Split the BeYours-owned keys into --path=/platform —
   the ownership table in apps/docs/deployment/infisical.md says which.

2. Vercel — the site's server-side values.

     vercel env pull /tmp/from-vercel.env --environment=production
     infisical secrets set --file=/tmp/from-vercel.env \\
       --projectId=$INFISICAL_PROJECT_ID --env=${ENV} --path=/site
     rm -f /tmp/from-vercel.env

There is no third. This section used to name 13 E2E_* GitHub Secrets and a
/ci folder to put them in; the folder is gone and the secrets never existed.
Since #276 the e2e job starts its own Convex backend on the runner and reads no
application secret at all, and this repository stores exactly four secrets —
INFISICAL_CLIENT_ID, INFISICAL_CLIENT_SECRET, MIRROR_PUSH_TOKEN, TURBO_TOKEN.
GitHub is still write-only, so if you ever do need a value back out of it, take
it from the portal it came from or regenerate it: one rotation ends the question
of who has seen the old value.

Then verify against the repo's own spec, which is what makes the store
trustworthy for a build:

     node scripts/infisical-bootstrap.mjs check --env=${ENV}

The web UI also takes a .env by drag-and-drop, per folder, if you would rather
not use the CLI for the initial load.
`)
}


/* ── migrate: Convex → Infisical, routed by owner ────────────────────────── */

/**
 * The right-hand side of a KEY=VALUE line.
 *
 * Same rule as `parseValue` in apps/reference/e2e/load-env.ts and as
 * `parse_value` in apps/themes/scripts/setup-convex-env.sh — three readers of
 * the same format have to agree. `npx convex env list` prints
 *
 *   CONVEX_DEPLOYMENT=dev:youthful-goose-352 # team: …, project: …
 *
 * and taking everything after the `=` carries the comment into the value.
 */
function parseValue(raw) {
  const value = raw.trim()
  const quote = value[0]
  if (quote === '"' || quote === "'") {
    const end = value.indexOf(quote, 1)
    return end === -1 ? value.slice(1) : value.slice(1, end)
  }
  const comment = value.search(/\s#/)
  return comment === -1 ? value : value.slice(0, comment).trimEnd()
}

/** Where each app's Convex project config lives, so `convex env` has a cwd. */
const CONVEX_DIR = {
  reference: "apps/reference",
  themes: "apps/themes",
  site: "apps/site",
  platform: "apps/reference",
}

function cmdMigrate() {
  requireCli()
  const source = flag("from-convex")
  const fromFile = flag("from-file")
  const apply = argv.includes("--apply")
  if (!ONLY || (!source && !fromFile)) {
    console.error(
      "migrate needs --scope=<name> and one of --from-convex=<deployment|prod> / --from-file=<dotenv>",
    )
    process.exit(EXIT_USAGE)
  }
  const target = SCOPES[ONLY]
  const dir = path.join(ROOT, flag("dir", CONVEX_DIR[ONLY] ?? "apps/reference"))

  // Pull. Whatever the source, the payload holds values: it is parsed and never
  // printed. `--from-file` exists for the halves Convex does not hold — the
  // Next side of an app lives on Vercel, so `vercel env pull` writes a dotenv
  // and this reads it, routing and filtering it exactly like a deployment.
  let raw
  if (fromFile) {
    const abs = path.isAbsolute(fromFile) ? fromFile : path.join(process.cwd(), fromFile)
    if (!fs.existsSync(abs)) {
      console.error(`\nNo such file: ${abs}`)
      process.exit(1)
    }
    raw = fs.readFileSync(abs, "utf8")
  } else try {
    // `--deployment-name`, not `--deployment`: `convex env --help` advertises
    // the latter on the parent command, and `convex env list` rejects it.
    // Checked against convex 1.x on 2026-09-01 — read `convex env list --help`,
    // not the parent's, if this ever breaks again.
    const args = ["convex", "env", "list"]
    if (source === "prod") args.push("--prod")
    else args.push("--deployment-name", source)
    raw = execFileSync("npx", args, {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      // The CLI wants a project context before it will honour
      // --deployment-name, and there is no .env.local in a fresh clone. This
      // supplies one without writing a file.
      env: { ...process.env, CONVEX_DEPLOYMENT: source === "prod" ? (process.env.CONVEX_DEPLOYMENT ?? "") : source },
    })
  } catch (e) {
    const err = String(e.stderr ?? "") + String(e.message ?? "")
    console.error(`\nCould not read ${source} from ${path.relative(ROOT, dir)}:`)
    if (/don't have access|do not have access/i.test(err)) {
      console.error("  The Convex CLI is logged in as an account that cannot see this")
      console.error("  deployment. Two accounts are in play — see the inventory in README")
      console.error("  and tasks/convex-account-cutover-runbook.md.")
      console.error("")
      console.error("    npx convex logout && npx convex login   # as the owner of this deployment")
      console.error("")
      console.error("  Or copy the values out of the Convex dashboard instead.")
    } else {
      console.error("  " + err.trim().split("\n").filter(Boolean).slice(-3).join("\n  "))
    }
    process.exit(1)
  }

  const pairs = []
  for (const line of raw.split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq === -1) continue
    const key = t.slice(0, eq).trim()
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) continue
    const rhs = t.slice(eq + 1)
    if (rhs.trimStart().startsWith("#")) continue // comment, no value
    const value = parseValue(rhs)
    if (value) pairs.push([key, value])
  }
  raw = null

  // Route by owner. A key BeYours owns goes to /platform wherever it was found;
  // that split is the whole reason a rotation currently has to visit N places.
  const platformKeys = new Set(expectedKeys("platform"))
  const targetKeys = new Set(expectedKeys(ONLY))
  const buckets = new Map([["/platform", []], [target.path, []]])
  const owned = []
  const strays = []
  for (const [key, value] of pairs) {
    // Ownership is decided BEFORE the spec lookup, and that order is the fix.
    // Five of these names ARE in the specs — BETTER_AUTH_SECRET and
    // ENCRYPTION_KEY are in every app's .env.example — so a routing that asked
    // "is it in the spec?" first filed them under the scope and pushed them.
    // That is how `/themes` came to hold one deployment's generated secrets as
    // the defaults every client clone would start from.
    if (DEPLOYMENT_OWNED.has(key)) owned.push(key)
    else if (platformKeys.has(key)) buckets.get("/platform").push([key, value])
    else if (targetKeys.has(key)) buckets.get(target.path).push([key, value])
    else strays.push(key)
  }

  console.log(`\nRead ${pairs.length} variables from ${source ?? fromFile}. Routing:`)
  for (const [dest, list] of buckets) {
    console.log(`\n  ${dest}  (${list.length})`)
    for (const [k] of list) console.log(`    ${k}`)
  }
  if (owned.length) {
    console.log(`\n  NOT PUSHED — the deployment owns these (${owned.length}): ${owned.join(", ")}`)
    console.log("  Generated for ONE backend — by the auth tooling, or by `seed` on the")
    console.log("  deployment itself. Never store them here, never copy them between")
    console.log("  deployments, and never delete them from the deployment that holds them.")
  }
  if (strays.length) {
    console.log(`\n  NOT PUSHED — in no spec (${strays.length}): ${strays.join(", ")}`)
    console.log("  Either they are dead on that deployment, or a .env.example is behind.")
    console.log("  Check before assuming the second: a name absent from the spec is more")
    console.log("  often a leftover than a gap.")
  }

  if (!apply) {
    console.log("\nDry run. Re-run with --apply to push.\n")
    return
  }

  for (const [dest, list] of buckets) {
    if (!list.length) continue
    const prev = process.umask(0o077)
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "inf-")), "env")
    process.umask(prev)
    try {
      fs.writeFileSync(tmp, list.map(([k, v]) => `${k}=${v}`).join("\n") + "\n", { mode: 0o600 })
      execFileSync(
        "infisical",
        ["secrets", "set", `--file=${tmp}`, `--projectId=${PROJECT_ID}`, `--env=${ENV}`, `--path=${dest}`],
        { stdio: ["ignore", "ignore", "pipe"], env: { ...process.env, INFISICAL_DISABLE_UPDATE_CHECK: "true" } },
      )
      console.log(`  pushed ${list.length} to ${dest} (${ENV})`)
    } catch (e) {
      console.error(`  FAILED ${dest}: ${String(e.stderr ?? e.message).trim().split("\n").pop()}`)
      process.exitCode = 1
    } finally {
      fs.rmSync(path.dirname(tmp), { recursive: true, force: true })
    }
  }
  console.log(`\nVerify: node scripts/infisical-bootstrap.mjs check --env=${ENV}\n`)
}


/* ── seed: the values the templates already decided ──────────────────────── */

/**
 * A committed value that is a stand-in, not a decision. Storing one is worse
 * than storing nothing: `check` counts it, so the folder reports as filled on
 * the strength of a value nobody chose.
 */
const IS_PLACEHOLDER = /your-|VOTRE|placeholder|\.\.\.|changeme|xxx/i

/**
 * Secrets the templates tell you to generate rather than obtain. The commands
 * are the ones written next to each key in the .env.example files.
 */
const GENERATORS = {
  BETTER_AUTH_SECRET: () => crypto.randomBytes(32).toString("base64"),
  EMAIL_API_SECRET: () => crypto.randomBytes(32).toString("base64"),
  ADMIN_BOOTSTRAP_TOKEN: () => crypto.randomBytes(32).toString("base64"),
  ENCRYPTION_KEY: () => crypto.randomBytes(32).toString("hex"),
  SEED_PASSWORD: () => `seed-${crypto.randomBytes(9).toString("base64url")}`,
}

// Anything this script can mint is per-deployment by construction, so the two
// lists cannot be allowed to disagree. Stated as a check rather than as a
// derivation because DEPLOYMENT_OWNED is read far above and also carries the
// auth pair, which has no generator here.
for (const key of Object.keys(GENERATORS)) {
  if (!DEPLOYMENT_OWNED.has(key)) {
    throw new Error(`${key} has a generator but is not in DEPLOYMENT_OWNED — see that comment.`)
  }
}

/** KEY=VALUE pairs from a spec, with the value kept verbatim. */
function specPairs(rel) {
  const file = path.join(ROOT, rel)
  if (!fs.existsSync(file)) return []
  const out = []
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m) out.push([m[1], m[2].trim()])
  }
  return out
}

/**
 * Fills an environment with what the repository has already decided: the real
 * values committed in the .env.example files, and the secrets those files tell
 * you to generate.
 *
 * REFUSED ON prod, and the reason is not squeamishness. Most committed values
 * in the engine's templates are `http://localhost:3000` — right for a developer,
 * actively wrong on a production folder, and indistinguishable from a real
 * answer once stored. Production gets real values or nothing.
 */
function cmdSeed() {
  requireCli()
  const apply = argv.includes("--apply")

  // On prod, committed defaults are refused and generated secrets are not.
  // The danger was never randomness: it is that most committed values in the
  // engine's templates are `http://localhost:3000`, right for a developer and
  // wrong on a production folder, and indistinguishable from a real answer once
  // stored. A generated secret has the opposite property — it is only ever
  // correct where nothing holds one yet, and `seed` never overwrites.
  const defaultsAllowed = ENV !== "prod"
  if (!defaultsAllowed) {
    console.log("\nprod: committed defaults are skipped (they are localhost URLs).")
    console.log("Generated secrets are still filled — but only where the folder has none.")
  }

  for (const name of scopeNames) {
    const scope = SCOPES[name]
    // A generated secret belongs to one backend. /reference, /site and /demo
    // each ARE one backend; /platform and /themes are copied to every
    // deployment that reads them, so minting one there mints it for everybody.
    // Seeding /themes is how seventeen of them got into the store in the first
    // place.
    const isShared = SHARED_FOLDERS.has(scope.path)
    const { keys: have = [] } = storedKeys(scope.path)
    const seen = new Set()
    const take = [], generate = [], skip = [], refused = []
    for (const spec of scope.specs) {
      for (const [k, v] of specPairs(spec)) {
        if (seen.has(k)) continue
        seen.add(k)
        if (have.includes(k)) { skip.push(k); continue }
        if (isShared && DEPLOYMENT_OWNED.has(k)) { refused.push(k); continue }
        if (GENERATORS[k]) generate.push(k)
        else if (!defaultsAllowed) continue
        else if (!v || IS_PLACEHOLDER.test(v)) continue
        else take.push([k, v])
      }
    }
    console.log(`\n${scope.path}  (${ENV})`)
    console.log(`  committed values: ${take.length}   generated secrets: ${generate.length}` +
      (skip.length ? `   already there, untouched: ${skip.length}` : ""))
    for (const [k, v] of take) console.log(`    ${k}=${v}`)
    for (const k of generate) console.log(`    ${k}=<generated>`)
    if (refused.length) {
      console.log(`  refused — per-deployment, and this folder is shared (${refused.length}):`)
      console.log(`    ${refused.join(", ")}`)
      console.log("  Seed them on the folder of the ONE environment that owns them.")
    }

    if (!apply || (!take.length && !generate.length)) continue
    const lines = [
      ...take.map(([k, v]) => `${k}=${v}`),
      ...generate.map((k) => `${k}=${GENERATORS[k]()}`),
    ]
    const prev = process.umask(0o077)
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "inf-")), "env")
    process.umask(prev)
    try {
      fs.writeFileSync(tmp, lines.join("\n") + "\n", { mode: 0o600 })
      execFileSync(
        "infisical",
        ["secrets", "set", `--file=${tmp}`, `--projectId=${PROJECT_ID}`, `--env=${ENV}`, `--path=${scope.path}`],
        { stdio: ["ignore", "ignore", "pipe"], env: { ...process.env, INFISICAL_DISABLE_UPDATE_CHECK: "true" } },
      )
      console.log(`  pushed ${lines.length}`)
    } catch (e) {
      console.error(`  FAILED: ${String(e.stderr ?? e.message).trim().split("\n").pop()}`)
      process.exitCode = 1
    } finally {
      fs.rmSync(path.dirname(tmp), { recursive: true, force: true })
    }
  }
  if (!apply) console.log("\nDry run. Re-run with --apply to push.\n")
}


/* ── run: the store as the environment of a local command ────────────────── */

/**
 * Runs a command with a folder's secrets in its environment.
 *
 * This is what makes the store the source for local development rather than a
 * place secrets are also kept. `infisical run` injects and the command never
 * sees a file, so there is no `.env.local` to drift, to leak, or to forget to
 * update after a rotation.
 *
 *   node scripts/infisical-bootstrap.mjs run --scope=site -- pnpm dev:site
 *
 * Two folders are loaded, in order: /platform first — the credentials BeYours
 * owns and every app shares — then the scope's own, so a scope-specific value
 * wins. Same contract as the CI jobs, deliberately: one rule to remember.
 */
function cmdRun() {
  const optional = argv.includes("--optional")
  // `--optional` is what lets an app's own `dev` script go through the store by
  // default. Without it, a missing CLI or an unset project id would stop a
  // developer from working at all, and the wiring would have to be opt-in —
  // which means forgettable, which is the failure it exists to prevent.
  if (optional && !storeReachable()) {
    const sep0 = argv.indexOf("--")
    const cmd0 = sep0 === -1 ? [] : argv.slice(sep0 + 1)
    console.log("[env] Infisical unavailable — running without the store.")
    console.log("[env] Install the CLI and set INFISICAL_PROJECT_ID to use it;")
    console.log("[env] see apps/docs/deployment/infisical.md.")
    try {
      execFileSync(cmd0[0], cmd0.slice(1), { stdio: "inherit", env: process.env })
    } catch (e) {
      process.exitCode = e.status ?? 1
    }
    return
  }
  requireCli()
  const sep = argv.indexOf("--")
  const command = sep === -1 ? [] : argv.slice(sep + 1)
  if (!ONLY || !command.length) {
    console.error("Usage: run --scope=<name> [--env=dev] -- <command...>")
    process.exit(EXIT_USAGE)
  }
  const scope = SCOPES[ONLY]
  // `infisical run` takes one path, so /platform is exported first and passed
  // through the environment; the scope's own folder then overrides it.
  let shared = ""
  try {
    shared = execFileSync(
      "infisical",
      ["export", "--format=dotenv", `--projectId=${PROJECT_ID}`, `--env=${ENV}`, "--path=/platform"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, INFISICAL_DISABLE_UPDATE_CHECK: "true" } },
    )
  } catch { /* /platform empty or unreadable: the scope alone still works */ }

  const inherited = { ...process.env, INFISICAL_DISABLE_UPDATE_CHECK: "true" }
  for (const line of shared.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m) inherited[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }

  console.log(`${scope.path} (${ENV}) → ${command.join(" ")}`)
  try {
    execFileSync(
      "infisical",
      ["run", `--projectId=${PROJECT_ID}`, `--env=${ENV}`, `--path=${scope.path}`, "--", ...command],
      { stdio: "inherit", env: inherited },
    )
  } catch (e) {
    process.exitCode = e.status ?? 1
  }
}

switch (command) {
  case "folders": cmdFolders(); break
  case "check": cmdCheck(); break
  case "plan": cmdPlan(); break
  case "migrate": cmdMigrate(); break
  case "seed": cmdSeed(); break
  case "run": cmdRun(); break
  case "scopes": cmdScopes(); break
  case "doc": cmdDoc(); break
  default:
    console.error("Usage: infisical-bootstrap.mjs <folders|check|doc|plan|scopes|migrate|seed|run> [--env=dev] [--scope=name]")
    console.error("")
    console.error(`Exit codes: ${EXIT_OK} complete · ${EXIT_INCOMPLETE} store incomplete · ` +
      `${EXIT_USAGE} usage · ${EXIT_STORE_DOWN} store unreachable`)
    process.exit(EXIT_USAGE)
}
