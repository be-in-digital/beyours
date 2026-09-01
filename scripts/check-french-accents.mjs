#!/usr/bin/env node
/**
 * Guards French user-facing copy against silent de-accenting.
 *
 * Three things went wrong and none was visible to any existing job:
 *
 *   1. `apps/reference` and `apps/themes` are near-identical twins, and a fix
 *      landed in one of them only. Commit 4ff7d15 put the accents back in the
 *      reference blog and kitchen screens; the client template kept "Commande
 *      prete" and "Echec de la mise a jour" for everyone who bought it.
 *
 *   2. A second body of copy was de-accented in BOTH apps at once. `diff` says
 *      nothing when the twins agree on the same error, so parity alone cannot
 *      see it. "La date de publication doit etre dans le futur", "n'est pas
 *      configure" and "l'import reel" survived a twin check for exactly that
 *      reason.
 *
 *   3. The reference the check did own was a hand-written list of misspellings,
 *      so it only ever found the faults somebody had already thought of. It did
 *      not contain `etre`, and `etre` was wrong 27 times.
 *
 * So the check now has an ABSOLUTE reference — `french-accented-words.txt`,
 * a list of French words that must carry their accents — and asks of every
 * French string, on its own, whether it spells one of them without. Nothing in
 * that question involves the other app, so a fault present in both is caught
 * the same as a fault present in one.
 *
 * The twin check is kept: it needs no vocabulary at all, and it still catches
 * the case where one app was fixed and the other was not.
 *
 * Usage:  node scripts/check-french-accents.mjs   (also: pnpm check:accents)
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, "..")
const SKIP_DIRS = new Set(["node_modules", ".next", ".turbo", "dist", "_generated", ".git"])
const CODE = /\.(ts|tsx|mjs|js|jsx)$/
const JSON_FILE = /\.json$/

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

/* ── Check 2: measured against the word list, not against the other app ─── */

const WORDS_FILE = path.join(HERE, "french-accented-words.txt")

/**
 * deaccented lowercase spelling -> { should, frenchOnly }.
 *
 * `frenchOnly` marks the words under [french]: they are spelled like English
 * words, so they are only evidence of a missing accent inside a string that is
 * positively French.
 */
function loadAuthority() {
  const lines = fs
    .readFileSync(WORDS_FILE, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
  const map = new Map()
  let frenchOnly = false
  for (const w of lines) {
    if (w === "[any]") { frenchOnly = false; continue }
    if (w === "[french]") { frenchOnly = true; continue }
    const key = deaccent(w).toLowerCase()
    // A word that is its own de-accented form carries no accent and would make
    // the check fire on correct copy. Refuse it loudly rather than at 3am.
    if (key === w.toLowerCase()) {
      throw new Error(`${path.relative(ROOT, WORDS_FILE)}: "${w}" has no accent — remove it.`)
    }
    if (!map.has(key)) map.set(key, { should: w, frenchOnly })
  }
  return map
}

// Spellings the word list would flag but that are correct where they appear.
// Each entry needs a reason: this list is how the check stays believable.
const ALLOWED = [
  // Not French. The word list is French, so its entries mean nothing here.
  { file: "apps/themes/lib/i18n/locales/en.json", reason: "English locale" },
  { file: "apps/reference/lib/i18n/locales/en.json", reason: "English locale" },
  { file: "apps/themes/lib/i18n/locales/es.json", reason: "Spanish locale" },
  { file: "apps/reference/lib/i18n/locales/es.json", reason: "Spanish locale" },
]

/**
 * Which strings are French copy.
 *
 * The first instinct — "French only if it looks French" — throws away exactly
 * the copy this check exists for: "Commande prete" carries no accent and no
 * grammar word, and it is the string from the original bug report. So the rule
 * is inverted. A string is treated as French unless it reads as English, and
 * the English test is the one that is easy to make reliable: test names and
 * code comments are dense in English function words, and French copy has none.
 */
const FRENCH_MARKER =
  /(?:^|[\s"'>(«])(le|la|les|un|une|des|du|de|et|ou|est|sont|pour|avec|dans|sur|vous|votre|vos|nous|notre|ce|cette|cet|par|aux|qui|que|pas|plus|tout|toute|sans|en|au|ne|si|son|sa|ses|leur|mais|donc|car|chaque|tous)(?:[\s,.!?;:'’]|$)/i

const ENGLISH_MARKER =
  /(?:^|[\s"'>(])(the|a|an|is|are|was|were|be|been|has|have|had|does|do|did|with|without|and|or|of|to|for|that|which|this|these|those|from|by|on|in|at|it|its|not|no|when|then|than|should|would|could|must|but|as|so|if|into|over|under|after|before|only|every|each|any|all|why|how|what|where|who)(?:[\s,.!?;:'’]|$)/i

/** An accent or a grammar word: this string is French, whatever else it holds. */
function isPositivelyFrench(text) {
  return /[À-ɏ]/.test(text) || FRENCH_MARKER.test(text)
}

function isFrench(text) {
  if (isPositivelyFrench(text)) return true
  return !ENGLISH_MARKER.test(text)
}

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
  // A bare identifier, a dotted translation key or a slug — `categories`,
  // `heroImage`, `storefront.categories`, `salade-cesar`. A slug is *supposed*
  // to be unaccented; flagging `food-truck-boheme` would be asking for a URL
  // that breaks.
  if (!/\s/.test(t) && /^[a-z][a-zA-Z0-9_.-]*$/i.test(t)) return false
  return true
}

function readableText(source) {
  const spans = []
  const patterns = [
    /"((?:[^"\\\n]|\\.)*)"/g, // "…"
    /'((?:[^'\\\n]|\\.)*)'/g, // '…'
    /`((?:[^`\\]|\\.)*)`/g, // `…`
    />([^<>{}\n]+)</g, // JSX text — one line only, no expressions
  ]
  for (const re of patterns) {
    for (const m of source.matchAll(re)) {
      // `${operation}` inside a template literal is code, and its identifier is
      // not copy: "opération refusée : ${operation}" was reporting a missing
      // accent on the variable name.
      const text = (m[1] ?? "").replace(/\$\{[^}]*\}/g, " ")
      if (isCopy(text)) spans.push({ text, index: m.index })
    }
  }
  return spans
}

/**
 * Locale files are JSON, and their keys are identifiers while their values are
 * the shipped copy. Parsing rather than regexing keeps `storefront.categories`
 * out of the results and `Catégories` in.
 */
function jsonText(source) {
  const spans = []
  let parsed
  try {
    parsed = JSON.parse(source)
  } catch {
    return spans
  }
  const visit = (node) => {
    if (typeof node === "string") {
      if (isCopy(node)) spans.push({ text: node, index: source.indexOf(node) })
    } else if (Array.isArray(node)) node.forEach(visit)
    else if (node && typeof node === "object") Object.values(node).forEach(visit)
  }
  visit(parsed)
  return spans
}

/** Flag every de-accented spelling of an authority word inside French copy. */
function scanText(spans, authority, locate) {
  const found = []
  for (const span of spans) {
    if (!isFrench(span.text)) continue
    const positivelyFrench = isPositivelyFrench(span.text)
    // Tokenise on letters INCLUDING accented ones, then keep the tokens that are
    // pure ASCII. Splitting on /[A-Za-z]+/ instead cuts "Paramètres" into
    // "Param" + "tres" and reports a missing accent on a word that has one.
    for (const m of span.text.matchAll(/[\p{L}\p{M}]{3,}/gu)) {
      const token = m[0]
      if (/[^A-Za-z]/.test(token)) continue // already accented, or not Latin
      const entry = authority.get(token.toLowerCase())
      if (!entry) continue
      if (entry.frenchOnly && !positivelyFrench) continue
      found.push({
        line: locate(span.index),
        word: token,
        should: entry.should,
        text: span.text.trim().slice(0, 70),
      })
    }
  }
  return found
}

function checkDictionary(authority) {
  const failures = []
  for (const dir of ["apps", "packages"]) {
    for (const file of walk(path.join(ROOT, dir))) {
      const isCode = CODE.test(file)
      const isJson = JSON_FILE.test(file)
      if (!isCode && !isJson) continue
      const rel = path.relative(ROOT, file)
      if (ALLOWED.some((a) => rel === a.file)) continue

      const source = fs.readFileSync(file, "utf8")
      const lineStarts = [...source.matchAll(/\n/g)].map((m) => m.index)
      const lineOf = (i) => lineStarts.filter((s) => s < i).length + 1

      const spans = isJson ? jsonText(source) : readableText(source)
      for (const hit of scanText(spans, authority, lineOf)) failures.push({ file: rel, ...hit })
    }
  }
  return failures
}

/* ── Check 0: the guard has to still work ───────────────────────────────── */

/**
 * The failure this whole script exists to prevent is a check that reports
 * success over a defect. A word list is easy to gut by accident — one bad edit
 * and it silently matches nothing — so prove on every run that it still catches
 * the three strings that got through the twin comparison, and still keeps quiet
 * about correct French.
 */
const SELF_TEST = {
  mustFlag: [
    ["La date de publication doit etre dans le futur", "etre"],
    ["Le renouvellement en ligne n'est pas configure (STRIPE_BID). Contactez BeYours.", "configure"],
    ["Mode aperçu — aucune donnée modifiée. ATTENTION : l'import reel n'est pas atomique.", "reel"],
    ["Selectionnez au moins un element a migrer", "element"],
    ["Commande prete", "prete"],
  ],
  mustIgnore: [
    "Comment ça marche",
    "Expire bientôt",
    "Basculez entre vue liste et vue grille avec les boutons à droite.",
    "Une ferme, un four, une table.",
    "Copie impossible — copiez le lien manuellement",
    "a live founders sale without the creation product is refused",
    "reads a creation, which carries a snapshot and no change list",
  ],
}

function selfTest(authority) {
  const problems = []
  for (const [text, word] of SELF_TEST.mustFlag) {
    const hits = scanText([{ text, index: 0 }], authority, () => 1)
    if (!hits.some((h) => h.word.toLowerCase() === word)) {
      problems.push(`should have flagged "${word}" in: ${text}`)
    }
  }
  for (const text of SELF_TEST.mustIgnore) {
    const hits = scanText([{ text, index: 0 }], authority, () => 1)
    if (hits.length) {
      problems.push(`should have ignored, but flagged ${hits.map((h) => h.word).join(", ")} in: ${text}`)
    }
  }
  return problems
}

/* ── Report ─────────────────────────────────────────────────────────────── */

const authority = loadAuthority()

const broken = selfTest(authority)
if (broken.length) {
  console.error(`\n✗ The accent check itself is broken — ${broken.length} self-test failure(s).\n`)
  for (const p of broken) console.error(`    ${p}`)
  console.error(`\n  ${path.relative(ROOT, WORDS_FILE)} no longer detects what it was written for.\n`)
  process.exit(1)
}

const twins = checkTwins()
const words = checkDictionary(authority)

if (twins.length) {
  console.error(`\n✗ ${twins.length} file(s) differ between apps/reference and apps/themes by accents alone.`)
  console.error("  The twins must carry the same copy. Port the fix to both.\n")
  for (const f of twins) console.error(`    ${f}`)
}

if (words.length) {
  console.error(`\n✗ ${words.length} de-accented French word(s) in user-facing text.\n`)
  for (const f of words) {
    console.error(`    ${f.file}:${f.line}  ${f.word} → ${f.should}`)
    console.error(`      ${f.text}`)
  }
  console.error(`\n  If a spelling is correct where it appears — an enum value, an English`)
  console.error(`  word, a French word that takes no accent — either drop the entry from`)
  console.error(`  ${path.relative(ROOT, WORDS_FILE)} or add the file to ALLOWED in`)
  console.error(`  ${path.relative(ROOT, fileURLToPath(import.meta.url))}.`)
}

if (twins.length || words.length) {
  console.error(`\nFrench accent check failed.\n`)
  process.exit(1)
}

console.log(
  `French accent check passed: twins agree, and ${authority.size} accented spellings are respected.`
)
