#!/usr/bin/env node
/**
 * Compiles `app/globals.css` the way Next does, for the layout harness (#507).
 *
 * WHY THIS EXISTS. The layout families are CSS, and the one question that
 * matters about a new family's rule — does it lay out the way it is meant to —
 * cannot be answered by any test in this repository: jsdom parses CSS and does
 * not lay it out, so `getComputedStyle` returns the declared value and no
 * geometry. A real browser is the only instrument, and a real browser needs the
 * real stylesheet.
 *
 * Output: `.layout-harness/globals.css` (gitignored). Run via
 * `node scripts/layout-harness-css.mjs`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, ".layout-harness");

const source = fs.readFileSync(path.join(ROOT, "app/globals.css"), "utf8");

const result = await postcss([tailwind()]).process(source, {
  from: path.join(ROOT, "app/globals.css"),
  to: path.join(OUT, "globals.css"),
});

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "globals.css"), result.css);

const rules = (result.css.match(/\{/g) ?? []).length;
console.log(`.layout-harness/globals.css — ${(result.css.length / 1024).toFixed(1)} KB, ~${rules} rules`);
if (rules < 500) {
  console.error("Refusing a stylesheet this small: the content scan found nothing.");
  process.exit(1);
}
