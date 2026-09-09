# Colour contrast, measured — issue #410

**Measured on 8 September 2026 against the tree at `e8a396e`.** Every number
below is the output of a command, not an opinion, and the command is in the
repository: `packages/ui/src/lib/contrast-scan.ts`, run by
`apps/*/tests/a11y/contrast.test.ts`. Re-run it before quoting any of these
figures again.

Raised by the owner from real use — « parfois les couleurs ne sont pas très
visibles » — which turned out to be an understatement.

---

## The instrument, and why it should be believed

`readableForeground` in `packages/ui/src/lib/branding.ts` was already
contrast-correct: a 262 144-colour sweep puts its worst case at 4.58:1, so every
foreground the branding picker *derives* clears AA. It has nothing to say about
the colours nobody derives — a `text-zinc-400` typed into a className, a
`--muted-foreground` read out of `globals.css`, a `bg-[#0D5C3F]` on a sign-in
page. That is the whole of what was measured here.

Two modules, both in the package that owns the colours:

- **`lib/contrast.ts`** — WCAG 2.1 relative luminance and contrast on sRGB, plus
  parsing for every spelling a stylesheet can produce: **oklch** (Tailwind v4's
  palette, read out of the installed `tailwindcss/theme.css` rather than
  transcribed), **HSL triples** (the design tokens), **hex** (the literals). It
  also carries the two compositing rules that decide whether a number is real:
  `over()` for a `/60` alpha modifier, and `throughGroup()` for `opacity`, which
  composites an element's whole subtree — *its background with it* — over what
  is behind. Dimming only the foreground is the mistake that invents failures a
  browser never renders.
- **`lib/contrast-scan.ts`** — walks every `.tsx` with the TypeScript compiler,
  resolves each element's effective foreground and background through its
  ancestry, in both colour schemes and in each interactive state, and returns
  every pair below the floor.

**Checked against Chromium, not trusted.** Pairs are rendered in a real browser
with the app's real compiled stylesheet, each colour read back off a canvas so
oklch, `color-mix` and alpha compositing are resolved by the engine rather than
re-implemented. On the first sweep, **194 of 199 agreed to within 0.06**; the
five that did not sit between 7:1 and 16:1, where the residue is oklch
round-tripping and not a disagreement about whether a word can be read. Re-run
after every change here, over the whole resolved set: **389 of 398 agree**. Of
the nine, three differ by 0.06–0.07, and six are an artefact of the check itself
— the harness strips a `hover:` prefix to render the state, and Tailwind emits
only `.hover\:bg-green-700:hover`, so the fixture's element gets no background
at all. The scanner is right about those and the fixture is not.

Three classes of false positive were found and removed while calibrating, each
of which had invented dozens of failures:

1. `opacity` read as a foreground dimmer (above), and `opacity-0
   group-hover:opacity-100` read as a dimmer rather than a reveal.
2. A className built by a ternary read as one bag of classes, which pairs the
   *selected* ink with the *unselected* surface — `cond ? "bg-primary
   text-primary-foreground" : "bg-background text-foreground"` reported a 1:1
   failure that no state of the component produces. Branches are now separate
   alternatives.
3. `hover:bg-primary text-foreground hover:text-white` read as one state, which
   pairs the hovered ink with the resting surface. Each state is resolved whole.

**What it deliberately does not judge.** A pair whose surface is painted by a
component in *another* file is reported with `surfaceKnown: false`. No static
reading can say what colour an image is.

That exclusion used to be unbounded, and see **The 150** below for what it cost.
A region can now DECLARE the surface a shell paints behind it — a hex for a
literal, a token name for a shell that paints one — and the set of files still
unresolved is asserted to be exactly the five that render over the hero
photograph. Anything else that cannot be resolved fails.

WCAG floors applied: **4.5:1** for body text, **3:1** for large text (≥24px, or
≥18.66px at weight 700 or more) and for non-text elements that have to be seen.
Inactive controls are exempt per 1.4.3 — `disabled:`, `aria-disabled`,
`cursor-not-allowed`, and this codebase's `pointer-events-none opacity-50`
idiom are skipped.

---

## What was failing, at `e8a396e`

**484 rendered pairs below the AA floor** in `apps/themes`, of which 226 are in
light mode — that is, live for every diner and every owner today, with no dark
phone required. `apps/reference` is its byte-identical twin and measures the
same.

**All of them are now clear.** `apps/*/tests/a11y/contrast.test.ts` reports
`No pair below the WCAG 2.1 AA floor.` in both apps, and the whole monorepo
suite is green: `npx turbo run test --concurrency=1 --force` → `Tasks: 18
successful, 18 total`, `Cached: 0 cached`.

| region | failures | of which light mode | worst |
|---|---:|---:|---:|
| storefront | 285 | 103 | 1.03:1 |
| `packages/admin` (engine) | 126 | 79 | 1.28:1 |
| `(auth)` sign-in and sign-up | 54 | 27 | 1.48:1 |
| admin (app shell) | 16 | 14 | 1.96:1 |
| `packages/ui` (engine) | 3 | 3 | 2.85:1 |
| **total** | **484** | **226** | **1.03:1** |

### The twelve worst, verbatim

```
1.030:1 (needs 4.5) light  text-accent-foreground/60 #104e38 on bg-white/5      #174c38  components/storefront/storefront-footer.tsx:240
1.049:1 (needs 3)   dark   text-foreground          #1a1a1a on bg-card/40       #161e2c  app/(storefront)/_components/HomepageContent.tsx:312
1.062:1 (needs 4.5) light  text-accent-foreground/60 #15523c on bg-white/10     #235543  app/(storefront)/_components/HomepageContent.tsx:293
1.080:1 (needs 4.5) light  text-accent-foreground/40 #0b4831 on bg-primary-hover #0a422e components/storefront/storefront-footer.tsx:234
1.101:1 (needs 4.5) light  text-accent-foreground   #0b5037 on bg-white/10      #235543  app/(storefront)/_components/HomepageContent.tsx:255
1.103:1 (needs 3)   dark   text-foreground          #1a1a1a on bg-card          #090e1b  app/(storefront)/about/_components/AboutContent.tsx:203
```

Note the pattern in the first column: **these are not marginal.** 1.03:1 is text
the same colour as the surface it is printed on.

---

## The four root causes

### 1. The storefront had no dark palette at all — 1.10:1

`globals.css` declares the storefront's cream-and-green defaults on
`.storefront-theme`, which is a `<div>` in `components/storefront/storefront-shell.tsx`.
It named nine tokens, all of them light. `--card`, `--muted`, `--secondary` and
`--popover` were left to fall through to `.dark`, which paints them near-black.

A custom property declared **on** an element beats the one it would have
**inherited** — layers and specificity settle conflicts within one element, not
across the tree — so `--foreground` stayed `0 0% 10%` while `--card` became
`224 50% 7%`. Near-black text on a near-black card: **1.10:1**.

This was not hypothetical. `app/providers.tsx` sets
`defaultTheme="system" enableSystem`, and the storefront has no theme toggle, so
every diner whose phone is in dark mode got it and had no way out.

**Fixed** by giving `.storefront-theme` a dark counterpart — its own identity
inverted, not half of the engine's. Every value was solved rather than picked:
each ink clears 4.5:1 on every surface in the block, each label clears 4.5:1 on
its own fill, and `--primary`, `--ring`, `--input` and `--accent-solid` clear
3:1 against `--background` (1.4.11). `--border` deliberately does not — it is a
decorative separator, not a control boundary, which is why `--input` is a
separate and lighter value.

Verified in Chromium after the change: card `rgb(22, 34, 30)`, ink
`rgb(248, 247, 242)`.

### 2. `--accent-foreground` used as if it were `--primary-foreground` — 1.03:1

`--accent-foreground` is the ink for the pale `--accent` **tint**. In the
storefront both it (`158 75% 18%`) and `--primary-hover` (`158 73% 15%`) are
dark green, so writing the first on the second gives dark green on dark green.
The footer's contact block, its copyright line and the homepage CTA subtitle
were all painted this way, at 1.03:1 to 1.21:1, in **light mode** — no dark
phone needed. This is the most likely thing the owner actually saw.

Compounded by `/40`, `/60`, `/70` and `/80` opacity modifiers used to "soften"
the text, each of which multiplies the ratio further down.

**Fixed** by routing those literals to `--primary-foreground`, the token whose
whole job is to be the readable label for `--primary`, and which
`buildBrandingCss` derives with `readableForeground` so it stays readable under
any establishment's chosen colour.

### 3. The token matrix itself failed AA, before any literal was involved

Measured on the tokens alone, with no markup:

| pair | was | now |
|---|---:|---:|
| `--primary-foreground` on `--primary` (light) | 2.85:1 | 5.14:1 |
| the primary as text on `--muted` (light) | 2.60:1 | 4.68:1 |
| `--muted-foreground` on `--muted` (light) | 4.42:1 | 4.58:1 |
| `--destructive-foreground` on `--destructive` (light) | 3.78:1 | 5.04:1 |
| `text-destructive` on `--muted` (light) | 3.45:1 | 4.60:1 |
| `text-destructive` on `--muted` (dark) | 1.48:1 | 5.52:1 |
| `--info-foreground` on `--info` (light) | 3.63:1 | 5.98:1 |
| `text-accent-solid` on `--muted` (light) | 2.65:1 | 4.58:1 |

The token matrix is measured on its own, before any markup is involved: 30
pairs — every label on its own fill, every ink on every surface — in each of
the four scope-and-scheme combinations. All 120 now clear the floor. Before,
the storefront's dark scope did not exist and the other three failed between
four and thirteen of them each.

`--muted-foreground` moved one point of lightness — 46% to 45% — and that one
point is the difference between 4.42:1 and 4.58:1 in **952** places.

`--primary` moved sixteen, 53% to 37%, and that one needs stating plainly: **the
engine's default orange is now visibly deeper.** It had to move because the
token is used both ways — 217 `bg-primary` and 77 `text-primary` across the two
apps and the two UI packages — so it has to be readable *on* the light surfaces
as well as capable of carrying a label. Darkening it keeps the white-on-orange
design language; the alternative, flipping every button label to black, does
not. `globals.css` had documented the 2.85:1 for months as a known defect left
alone because fixing it "would restyle every site already delivered". #410 is
the decision to fix it.

`--warning` and `--info` are used **nowhere** as `text-` or `bg-` today, so
`--warning` was left alone; `--info` was corrected because the fix was free. The
guard will catch either the moment it is used.

### 4. Per-store branding never reached the storefront — the feature not working

Found while designing the fix for (1), and it is the same cascade rule. The
Design screen writes `stores.branding`, `buildBrandingCss` derives the tokens,
and `StoreTheme` emits them **unlayered** onto `:root` and `.dark` — which are
`<html>`. `.storefront-theme` redeclares nine of those tokens on a descendant
`<div>`, so it overwrote every one of them right back to the engine green.

Measured in Chromium, a store whose owner picked `#d32f2f`:

```
before   admin rgb(211, 49, 49)   storefront rgb(13, 94, 64)
after    admin rgb(211, 49, 49)   storefront rgb(211, 49, 49)
```

The differentiator this product is sold on worked in the administration and not
on the page a diner reads. `buildBrandingCss` now takes a `scopes` option and
the storefront passes `[".storefront-theme"]`.

---

## Colour alone — WCAG 1.4.1

Contrast is 1.4.3. The other half of #410 is 1.4.1: colour may never be the
*only* visual means of conveying information. Swept separately, across the
status badges, the kitchen display, the dashboard charts and the storefront's
availability badges. Most of the product was already compliant — every order and
store status prints its French word, the spice indicator uses a filled-vs-outline
shape, the dashboard legend carries a label and a count beside each swatch — and
those were left alone rather than "fixed".

Three surfaces were not:

| where | what colour carried alone | redundant cue |
|---|---|---|
| `packages/admin/src/pages/kitchen/ticket-timer.tsx` | the three urgency bands were `text-muted-foreground` → `text-yellow-600` → `text-red-600` and nothing else. The elapsed figure is not a cue: "14m" and "25m" are numbers unless you already know the thresholds — and this is the kitchen display, read across a room | a distinct shape per band (none / `AlertTriangle` / `AlertOctagon`), each with `role="img"` and a French `aria-label`. Colour kept |
| `components/storefront/store-selector-dropdown.tsx` (both apps) | a 6px dot, `bg-primary` against `bg-muted-foreground`, was the only signal that a location was taking orders — in the storefront header, on every page | the status word beside it, from the same `useStoreStatusLabels()` vocabulary the full store-selector page has always printed, so the two cannot drift. The dot is now `aria-hidden` |
| `packages/admin/src/pages/products/image-to-product/confidence-indicator.tsx` | the bar was `bg-green-500` / `bg-yellow-500` / `bg-red-500` and nothing else, on a screen whose entire job is "which of these suggestions must I check?" | an icon per band plus `role="img"` and an `aria-label` naming the band in words and repeating the percentage. The `title` attribute it relied on is not a reliable accessible name and never appears on touch |

Held by tests in the package that owns each component. Two of those tests are
guards rather than fixes: they iterate every status and assert a distinct
non-empty word, so a future change that reduces either badge to a swatch goes
red.

**One nearby defect deliberately left open:** the cancel control in
`packages/admin/src/pages/kitchen/ticket-card.tsx` is an icon-only button with
no accessible name at all — the reprint button beside it has a `title`. That is
4.1.2, not 1.4.1, and it belongs with the rest of the name-and-role sweep rather
than here.

## Two things this measurement found that are NOT fixed here

**The 51 vertical templates have the identical defect.** `pnpm template:apply
<slug>` writes `site/theme.css`, whose `:root` and `.dark` blocks also stop at
`<html>`. Measured in Chromium with `templates/pizzeria-milano`:

```
light   admin --primary rgb(182, 22, 44)   storefront --primary rgb(13, 94, 64)
dark    admin --primary rgb(230, 81, 101)  storefront --primary rgb(81, 200, 156)
```

A theme sold "by restaurant type" repaints the owner's screens and not the
diner's. The remedy is the same shape as (4) — emit the storefront scope from
`scripts/gen-templates.mjs`, or express the storefront defaults as
`var(--template-…, <default>)`. Two further facts for whoever takes it: no
template defines `--primary-hover` or `--accent-solid`, and the dark-mode
`--muted-foreground` values include seven outliers around L 68–69% that need
measuring against their own `--background`.

**A branded establishment can still write a word in `text-primary`.** The
default palette is measured clean, and `--primary` is now dark enough to be read
as well as filled. Under an establishment's own branding it is not: `--primary`
is written as exactly the colour the owner picked — that is the point of picking
it — so an owner who chooses `#FFEB3B` gets `text-primary` at 1.1:1 on white.
`--primary-ink` is the answer and it exists: `buildBrandingCss` derives it by
walking the same hue until it clears AA against the page, swept over the colour
cube and inverted. What is left is the mechanical half — **257 `text-primary`
occurrences** across `apps/*/app`, `apps/*/components`, `packages/admin/src` and
`packages/ui/src` that should read `text-primary-ink`. It cannot be verified by
this sweep, because the two tokens hold the same value in the default palette;
it is a change to make by reading, not by measuring, which is why it is recorded
here rather than done in a hurry. The rule to apply: `--primary` fills a shape,
`--primary-ink` writes a word.

**The QR game arena cannot use the token layer at all.** `GameShell` scopes an
establishment's branding to `[data-game-arena]` with `darkSelector: null`, and
the arena is not `.dark`, so `text-foreground` inside it resolves to the light
`:root` near-black — on a `#120d1a` stage. Tokens are not merely absent there;
they are actively wrong, which is why those eleven screens are painted in
literal hex and `text-white/25`…`/55`. Every pair in them now clears AA
(`text-white/70` reads 9.54:1 on the stage and 8.08:1 on its lightest panel;
the gold CTA lost a white label measuring 1.72:1), but by raising literals, not
by tokenising. The structural fix is a `[data-game-arena]` block in
`globals.css` beside `.storefront-theme`, which would make the arena measurable
the way everything else now is. Not done here: it is a second scope to design
and verify, and the screens are AA today without it.

**310 pairs have an unresolvable surface.** Listed by the scanner with
`surfaceKnown: false`. Most are text over a hero image or inside a shell painted
in another file — `components/storefront/storefront-header.tsx` in its
transparent state, and the game screens under `packages/admin/src/game/`, which
sit on `#120d1a` from `game-shell.tsx` and carry `text-white/25` through
`text-white/55`. Those opacity-attenuated labels are very likely failures; they
need a browser and a real page, not this sweep.

---

## What holds the floor now

`apps/themes/tests/a11y/contrast.test.ts` and its twin in `apps/reference` sweep
the storefront, the `(auth)` pages, the admin, the kitchen display and both
engine packages, in both colour schemes, and fail on any pair below AA whose
surface they can resolve. A second assertion checks the sweep is still resolving
several hundred pairs, because a scanner that has stopped working reports the
same green as a product with no failures.

In `packages/ui`, `branding.test.ts` gained sweeps for the two derived tokens
that had literals standing in for them — `--accent-solid-foreground` and
`--primary-ink` — over the colour cube. Both were inverted: with the derivations
replaced by the constants they used to be, they fail at 1.14:1 and 1.12:1.

### OBS-8

The two exhaustive sweeps in `branding.test.ts` were red in CI at 5 791 ms
against Vitest's 5 000 ms default, which `packages/ui/vitest.config.ts` never
overrode. The assertion passed; the budget did not. Reproduced here by running
the same suite with `--testTimeout=600` on a faster machine — `Error: Test timed
out in 600ms` while the sweep completed its work in 652 ms — and fixed with an
explicit 30-second budget stated per test, so an ordinary unit test in the
package keeps failing fast at the default. The same squeeze passes afterwards.

The grid was **not** coarsened. That sweep exists because an earlier version of
it was chosen where it could not fail.

---

## The 150 — 2026-09-09

The sweep above ended with a guarded count of **zero**. It reported 150 failing
pairs in `apps/themes` and dropped all 150 for an unresolved surface, so the
suite was green and had measured nothing. That is a worse state than a red one:
a green check is read as an answer.

Resolving the surfaces the scanner could not:

| | pairs | what they were |
| --- | --- | --- |
| the QR-game screens | 51 | opaque `bg-[#120d1a]`, painted by `game/game-shell.tsx` |
| the kitchen display | 4 | `background: #0f172a` on `.display-root`, in a stylesheet no `.tsx` mentions |
| the admin | 83 | rendered on `bg-background`, painted by `SidebarInset` |
| over a photograph | 12 | the storefront header and what sits inside it |

Only the last row is genuinely unknowable. `scanContrast` regions therefore take
an optional `surface` — a hex for a literal shell, a **token name** for one that
paints `bg-background`, since the admin's surface differs between the two colour
schemes and a hex cannot say that. Both apps' tests declare theirs, each read
from the source that paints it rather than transcribed, so repainting the arena
fails the read rather than silently measuring against a colour that has moved.

That left **89 real failures the guard had never been allowed to see.** Two were
scanner faults and are fixed there: `cursor-not-allowed` is the other spelling
of "inactive" beside `pointer-events-none` and was not exempted, and the
`store-hours-tab` row dimmed its « Fermé » switch along with the inputs it was
meant to grey — a control an owner needs in order to re-open the day, at 1.99:1.
The rest were the same four habits:

- **a raw Tailwind hue where a token exists** — `text-green-600` (9), `text-amber-500`
  (5), `text-red-500` (4), `text-emerald-500` (4), `text-orange-600` (3),
  `text-yellow-400`, `text-gray-500`, `text-slate-500`. All now `--success`,
  `--warning`, `--destructive` or `--muted-foreground`, which the token matrix
  already holds at AA in both schemes and which follow an establishment's
  branding.
- **an opacity modifier on text** — `text-muted-foreground/30` (6), `/50` (8),
  `/60` (4), `/70` (2), `text-foreground/50` (4). The header of this document
  already said never to do it; the modifier multiplies the ratio down silently,
  which is how the storefront footer once reached 1.07:1.
- **a chip tinted with its own ink** — `bg-amber-500/10 text-amber-500` at
  1.95:1, `bg-emerald-500/10 text-emerald-500` at 2.20:1. A pale wash under a
  bright letter of the same hue: no tuning of the tint fixes it, because the two
  are the same colour.
- **a light-only palette pair in dark mode** — the four inventory tiles,
  `bg-orange-50/50` over a near-black page compositing to a mid grey, with
  `text-orange-600` on it at **1.109:1**.

Two tokens moved with them, both in the improving direction and both for the
`bg-X/10 text-X` idiom, which is the least forgiving surface a token lands on:
`--success` 28% → 27% (4.43:1 → 4.66:1) and `--destructive` 47% → 44% (4.18:1 →
4.62:1) in light mode. Every other pairing they appear in gains.

**Where it stands now:** 0 unguarded failures, 12 unresolved pairs across the
five named files, and 94.2% of every pair the sweep resolves is guarded. The
suite asserts all three — the failures are zero, the unresolved FILES are
exactly that list, and the unresolved share stays under 8% — so the way this
went wrong the first time cannot recur quietly.

**Still not done:** the game arena is measured against a declared literal rather
than tokenised. A `[data-game-arena]` block in `globals.css` beside
`.storefront-theme` remains the structural fix, and the 51 template
stylesheets still target `:root`/`.dark` instead of `.storefront-theme` (see
above). Neither is a contrast failure today.
