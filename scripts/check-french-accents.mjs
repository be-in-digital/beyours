#!/usr/bin/env node
/**
 * Guards French user-facing copy against silent de-accenting.
 *
 * Two things went wrong and neither was visible to any existing job:
 *
 *   1. `apps/reference` and `apps/themes` are near-identical twins, and a fix
 *      landed in one of them only. Commit 4ff7d15 put the accents back in the
 *      reference blog and kitchen screens; the client template kept "Commande
 *      prete" and "Echec de la mise a jour" for everyone who bought it.
 *
 *   2. A second body of copy was de-accented in BOTH apps at once. `diff` says
 *      nothing when the twins agree on the same error, so parity alone cannot
 *      see it.
 *
 * So there are two checks here. `twins` is exact and has no vocabulary to
 * maintain. `lexicon` is a word list, and word lists go stale — keep it to
 * spellings that are only ever a missing accent, and put anything genuinely
 * ambiguous in ALLOWED below rather than weakening the pattern.
 *
 * Usage:  node scripts/check-french-accents.mjs   (also: pnpm check:accents)
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const SKIP_DIRS = new Set(["node_modules", ".next", ".turbo", "dist", "_generated", ".git"])
const CODE = /\.(ts|tsx|mjs|js|jsx)$/

const deaccent = (s) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "")

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

/* ── Check 1: the twins must not disagree about accents ─────────────────── */

function checkTwins() {
  const failures = []
  for (const refPath of walk(path.join(ROOT, "apps/reference"))) {
    const themePath = refPath.replace(`${path.sep}reference${path.sep}`, `${path.sep}themes${path.sep}`)
    if (!fs.existsSync(themePath)) continue
    let a, b
    try {
      a = fs.readFileSync(refPath, "utf8")
      b = fs.readFileSync(themePath, "utf8")
    } catch {
      continue
    }
    // Identical once accents are stripped, but not identical as bytes: the two
    // copies say the same words and disagree only about the diacritics.
    if (a !== b && deaccent(a) === deaccent(b)) {
      failures.push(path.relative(ROOT, themePath))
    }
  }
  return failures
}

/* ── Check 2: spellings that are only ever a missing accent ─────────────── */

// Whole words that have no accent-free meaning in this codebase's French copy.
// Deliberately narrow: a word that is also a valid identifier, an enum value or
// an English word does not belong here.
const LEXICON = [
  "Echec", "echoue", "echouee", "echoues", "echouees",
  "Etes-vous", "deja", "apres", "tres",
  "caracteres", "Parametres", "parametres",
  "systeme", "Systeme", "numero", "Numero",
  "irreversible", "authentifie", "authentifiee",
  "reessayer", "Reessayez", "reessayez",
  "etablissement", "etablissements", "Etablissement", "Etablissements",
  "equipe", "Equipe", "categorie", "Categorie",
  "verifiez", "Verifiez", "donnees", "Donnees", "requete", "Requete",
  "periode", "derniere", "hebergeur", "bientot", "prete", "Prete",
  "reservee", "proprietaire", "selectionne", "selectionner", "selectionnee",
  "Apercu", "apercu", "genere", "generee",
  "creee", "creees", "crees", "succes", "supprimee", "supprimees",
  "annulee", "annulees", "modifiee", "envoyee", "envoye", "publiee", "publiees",
  "recuperee", "reimpression", "Reimpression", "allergenes", "ALLERGENES",
]

// Spellings the lexicon would flag but that are correct where they appear.
// Each entry needs a reason: this list is how the check stays believable.
const ALLOWED = [
  // The English locale. "Categories" is the English word.
  { file: "apps/themes/lib/i18n/locales/en.json", reason: "English locale" },
  { file: "apps/reference/lib/i18n/locales/en.json", reason: "English locale" },
  // This guard names the misspellings it hunts for.
  { file: "scripts/check-french-accents.mjs", reason: "the lexicon itself" },
]

/**
 * Contents of string literals and JSX text — the only places copy can hide.
 *
 * Everything below exists to keep code out of the results. A check that cries
 * wolf on `categories.length` gets switched off, and then it guards nothing.
 */
function isCopy(text) {
  const t = text.trim()
  if (!t || !/\p{L}/u.test(t)) return false
  // Paths, URLs, import specifiers, CSS classes.
  if (/[/\\]/.test(t)) return false
  // Operators and member access: this is an expression, not a sentence.
  if (/(=>|===|==|&&|\|\||\.\w+\(|\?\.|\$\{?\w+\.)/.test(t)) return false
  // A bare lowercase identifier — `categories`, `heroImage`, `slug`.
  if (!/\s/.test(t) && /^[a-z][a-zA-Z0-9_]*$/.test(t)) return false
  return true
}

function readableText(source) {
  const spans = []
  const patterns = [
    /"((?:[^"\\\n]|\\.)*)"/g,      // "…"
    /'((?:[^'\\\n]|\\.)*)'/g,      // '…'
    /`((?:[^`\\]|\\.)*)`/g,        // `…`
    />([^<>{}\n]+)</g,           // JSX text — one line only, no expressions
  ]
  for (const re of patterns) {
    for (const m of source.matchAll(re)) {
      if (isCopy(m[1] ?? "")) spans.push({ text: m[1], index: m.index })
    }
  }
  return spans
}

function checkLexicon() {
  const word = new RegExp(`(?<![\\p{L}\\p{M}-])(${LEXICON.join("|")})(?![\\p{L}\\p{M}])`, "gu")
  const failures = []

  for (const dir of ["apps", "packages"]) {
    for (const file of walk(path.join(ROOT, dir))) {
      if (!CODE.test(file)) continue
      const rel = path.relative(ROOT, file)
      if (ALLOWED.some((a) => rel === a.file)) continue

      const source = fs.readFileSync(file, "utf8")
      const lineStarts = [...source.matchAll(/\n/g)].map((m) => m.index)
      const lineOf = (i) => lineStarts.filter((s) => s < i).length + 1

      for (const span of readableText(source)) {
        for (const m of span.text.matchAll(word)) {
          failures.push({ file: rel, line: lineOf(span.index), word: m[1], text: span.text.trim().slice(0, 70) })
        }
      }
    }
  }
  return failures
}

/* ── Report ─────────────────────────────────────────────────────────────── */

const twins = checkTwins()
const lexicon = checkLexicon()

if (twins.length) {
  console.error(`\n✗ ${twins.length} file(s) differ between apps/reference and apps/themes by accents alone.`)
  console.error("  The twins must carry the same copy. Port the fix to both.\n")
  for (const f of twins) console.error(`    ${f}`)
}

if (lexicon.length) {
  console.error(`\n✗ ${lexicon.length} de-accented French word(s) in user-facing text.\n`)
  for (const f of lexicon) {
    console.error(`    ${f.file}:${f.line}  ${f.word}`)
    console.error(`      ${f.text}`)
  }
  console.error(`\n  If a spelling is deliberate — an enum value, an English word, an`)
  console.error(`  identifier — add it to ALLOWED in ${path.relative(ROOT, fileURLToPath(import.meta.url))}.`)
}

if (twins.length || lexicon.length) {
  console.error(`\nFrench accent check failed.\n`)
  process.exit(1)
}

console.log("French accent check passed: twins agree, no de-accented copy found.")
