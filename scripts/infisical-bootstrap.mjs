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
 *   node scripts/infisical-bootstrap.mjs scopes
 *
 * Requires the Infisical CLI and INFISICAL_PROJECT_ID (see
 * apps/docs/deployment/infisical.md). `folders` and `check` also need you to be
 * logged in (`infisical login`) or to have INFISICAL_TOKEN set.
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
  themes: {
    path: "/themes",
    label: "apps/themes — template defaults, Next side + Convex side",
    specs: ["apps/themes/.env.example", "apps/themes/.env.convex.example"],
  },
}

/**
 * Variables a deployment owns, that no store should ever hold.
 *
 * `@convex-dev/auth` generates JWT_PRIVATE_KEY and JWKS with its own CLI and
 * writes them straight onto the deployment; the auth server reads them and no
 * application code ever names them. So they are invisible to grep, they look
 * exactly like orphans in an audit, and they are the one pair you must not
 * remove — without them nobody can sign in.
 *
 * They must not travel through Infisical either: they are per-deployment, and
 * pushing one deployment's key onto another would invalidate every session.
 */
const DEPLOYMENT_OWNED = new Set(["JWT_PRIVATE_KEY", "JWKS"])

/* ── argument handling ───────────────────────────────────────────────────── */

const argv = process.argv.slice(2)
const command = argv.find((a) => !a.startsWith("--"))
const flag = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const ENV = flag("env", "dev")
const ONLY = flag("scope")
const PROJECT_ID = process.env.INFISICAL_PROJECT_ID

const scopeNames = ONLY ? [ONLY] : Object.keys(SCOPES)
for (const name of scopeNames) {
  if (!SCOPES[name]) {
    console.error(`Unknown scope "${name}". Known: ${Object.keys(SCOPES).join(", ")}`)
    process.exit(2)
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

function requireCli() {
  try {
    execFileSync("infisical", ["--version"], { stdio: "ignore" })
  } catch {
    console.error("The Infisical CLI is not on PATH.")
    console.error("  brew install infisical/get-cli/infisical")
    process.exit(1)
  }
  if (!PROJECT_ID) {
    console.error("Set INFISICAL_PROJECT_ID (see apps/docs/deployment/infisical.md).")
    process.exit(1)
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
        process.exitCode = 1
        return
      }
      if (/exist/i.test(msg)) console.log(`  /${folder} already there`)
      else console.error(`  FAILED /${folder}: ${msg.trim().split("\n")[0] || "unknown"}`)
    }
  }
}

function cmdCheck() {
  requireCli()
  let problems = 0

  // Read /platform once. A BeYours-owned key is not missing from /ci just
  // because it lives where it belongs: the workflows load /platform and then
  // the scope's own folder, two steps, so the consumer really does get it.
  const platformKeys = new Set(expectedKeys("platform"))
  const platformStored = new Set(storedKeys(SCOPES.platform.path).keys ?? [])

  for (const name of scopeNames) {
    const scope = SCOPES[name]
    const want = expectedKeys(name)
    const { keys: have, error } = storedKeys(scope.path)
    console.log(`\n${scope.path}  (${ENV})`)
    if (error === "auth") {
      console.log()
      console.log(AUTH_HELP)
      process.exitCode = 1
      return
    }
    if (error) {
      problems++
      console.log(
        error === "missing"
          ? `  folder missing — run: node scripts/infisical-bootstrap.mjs folders --env=${ENV}`
          : `  unreadable: ${error}`,
      )
      continue
    }
    const viaPlatform =
      name === "platform" ? [] : want.filter((k) => !have.includes(k) && platformStored.has(k))
    const missing = want.filter((k) => !have.includes(k) && !viaPlatform.includes(k))
    // A BeYours-owned key is never "extra" wherever it turns up. Reporting the
    // shared set as strays in every folder would bury the ones that are.
    const extra = have.filter((k) => !want.includes(k) && !platformKeys.has(k))
    console.log(
      `  ${have.length} stored, ${want.length} expected` +
        (viaPlatform.length ? `, ${viaPlatform.length} supplied by /platform` : ""),
    )
    if (missing.length) {
      problems++
      console.log(`  MISSING (${missing.length}):`)
      for (const k of missing) console.log(`    - ${k}`)
    }
    if (extra.length) {
      console.log(`  not in any spec (${extra.length}): ${extra.join(", ")}`)
    }
    if (!missing.length && !extra.length) console.log("  complete")
  }
  console.log()
  if (problems) {
    console.log(`${problems} scope(s) incomplete. \`plan\` prints how to fill them.`)
    process.exitCode = 1
  }
}

function cmdPlan() {
  console.log(`
How the values get there. Run these yourself — nothing here is executed for
you, and no value is ever printed by this script.

Values live in three places today, so there are three moves.

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

3. GitHub Secrets — NOT retrievable. GitHub is write-only by design, so the
   13 E2E_* values cannot be pulled back out. Take them from the portals they
   came from, or regenerate them, and set them at --path=/ci. Regenerating is
   the better answer for anything that is a credential: it costs one rotation
   and ends the question of who has seen the old value.

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
    process.exit(2)
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
  const unknown = []
  for (const [key, value] of pairs) {
    if (platformKeys.has(key)) buckets.get("/platform").push([key, value])
    else if (targetKeys.has(key)) buckets.get(target.path).push([key, value])
    else unknown.push(key)
  }

  console.log(`\nRead ${pairs.length} variables from ${source ?? fromFile}. Routing:`)
  for (const [dest, list] of buckets) {
    console.log(`\n  ${dest}  (${list.length})`)
    for (const [k] of list) console.log(`    ${k}`)
  }
  const owned = unknown.filter((k) => DEPLOYMENT_OWNED.has(k))
  const strays = unknown.filter((k) => !DEPLOYMENT_OWNED.has(k))
  if (owned.length) {
    console.log(`\n  NOT PUSHED — the deployment owns these (${owned.length}): ${owned.join(", ")}`)
    console.log("  Generated by the auth tooling, per deployment. Never store them,")
    console.log("  never copy them between deployments, and never delete them.")
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
  if (ENV === "prod") {
    console.error("\nseed refuses to write to prod.")
    console.error("  Most committed defaults are localhost URLs — correct for a developer,")
    console.error("  wrong for production, and impossible to tell apart once stored.")
    console.error("  Fill prod from the deployments (`migrate`) and the provider portals.")
    process.exit(2)
  }

  for (const name of scopeNames) {
    const scope = SCOPES[name]
    const { keys: have = [] } = storedKeys(scope.path)
    const seen = new Set()
    const take = [], generate = [], skip = []
    for (const spec of scope.specs) {
      for (const [k, v] of specPairs(spec)) {
        if (seen.has(k)) continue
        seen.add(k)
        if (have.includes(k)) { skip.push(k); continue }
        if (GENERATORS[k]) generate.push(k)
        else if (!v || IS_PLACEHOLDER.test(v)) continue
        else take.push([k, v])
      }
    }
    console.log(`\n${scope.path}  (${ENV})`)
    console.log(`  committed values: ${take.length}   generated secrets: ${generate.length}` +
      (skip.length ? `   already there, untouched: ${skip.length}` : ""))
    for (const [k, v] of take) console.log(`    ${k}=${v}`)
    for (const k of generate) console.log(`    ${k}=<generated>`)

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

switch (command) {
  case "folders": cmdFolders(); break
  case "check": cmdCheck(); break
  case "plan": cmdPlan(); break
  case "migrate": cmdMigrate(); break
  case "seed": cmdSeed(); break
  case "scopes": cmdScopes(); break
  default:
    console.error("Usage: infisical-bootstrap.mjs <folders|check|plan|scopes|migrate|seed> [--env=dev] [--scope=name]")
    process.exit(2)
}
