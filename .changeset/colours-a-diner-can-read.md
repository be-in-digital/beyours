---
"@be-in-digital/ui": minor
---

Measure every rendered colour pair against WCAG AA, and let branding reach the storefront

Raised by an owner from real use — "parfois les couleurs ne sont pas très
visibles" — and then measured. Three things were true at once.

**Nothing measured the colours nobody derives.** `readableForeground` guarantees
AA for the palette the Design screen derives, and a 262 144-colour sweep holds
it. It says nothing about a `text-zinc-400` typed into a className or a
`--muted-foreground` read out of `globals.css`, and that is where the failures
were. `lib/contrast.ts` is the WCAG arithmetic for any colour a stylesheet can
produce — oklch (Tailwind v4's palette), HSL triples (the tokens), hex
(literals) — with alpha compositing and the group-opacity rule that a naive
model gets backwards. `lib/contrast-scan.ts` walks the JSX with the TypeScript
compiler, resolves each element's effective foreground and background through
its ancestry, per colour scheme and per interactive state, and returns every
pair below the floor. Both are exported (`./contrast`, `./contrast-scan`); the
numbers agree with Chromium on 194 of the first 199 pairs to within 0.06, and
the five that differ are above 7:1.

**An establishment's colours never reached its own storefront.** `globals.css`
declares the storefront palette on `.storefront-theme`, which is a `<div>`;
this stylesheet targeted `:root` and `.dark`, which are `<html>`. A custom
property declared on an element beats the one it would have inherited, so every
token the scope names was overwritten straight back to the engine green.
Measured in Chromium: a store that picked `#d32f2f` rendered `rgb(211, 49, 49)`
in its admin and `rgb(13, 94, 64)` on the page a diner reads. `buildBrandingCss`
now takes `scopes`, and the storefront passes `[".storefront-theme"]`.

**Two derived tokens were missing, and both had a literal standing in for
them.** `--accent-solid-foreground` is the label for the cart badge and the
"nouveau" pill, which the storefront wrote as `text-white` — 2.78:1 on the
shipped orange and 1.1:1 on a yellow an owner may pick. `--primary-ink` is the
brand colour a *word* can be written in, as opposed to the one a button is
filled with: `--primary` stays exactly the colour the owner chose because that
is the point of choosing it, and `text-primary` asks the same value to be read
on the page, which `#f97015` cannot do at 2.85:1. The ink is the same hue walked
until it clears AA against the page, which is the treatment
`--accent-foreground` already had. Both are swept over the colour cube.

`--sidebar-primary-foreground` is derived too. It was a fixed white in both
shipped palettes and the sidebar's own selected item measured **2.57:1** in dark
mode, where `--primary` is lifted to a light orange — the chrome an owner looks
at all day.

Every derived label is now chosen for the colour that will actually be
**painted**. `formatHsl` emits whole degrees and whole percents, and picking a
label for the unrounded candidate is a guarantee about a number nobody sees: it
left one pair at 4.4911:1 (`#a05010`). A sweep over the colour cube holds each
emitted fill against its emitted label, and fails at exactly that value if the
rounding is dropped.

Dark-mode guarantees are now measured against the *lightest* dark ground the
stylesheet is emitted for, so they hold on the storefront's as well as the
engine's.

Also: the two exhaustive sweeps in `branding.test.ts` carry an explicit budget.
They were red in CI at 5 791 ms against Vitest's 5 000 ms default — a guard
failing for a reason that has nothing to do with contrast is a guard people
learn to ignore.
