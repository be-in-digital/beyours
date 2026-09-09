---
"@be-in-digital/ui": minor
"@be-in-digital/admin": minor
---

Measure the colours the sweep was dropping, and stop the motion nobody could

The contrast sweep reported 150 failing pairs in `apps/themes` and excluded all
150 for an unresolved surface. The guarded count was zero: a suite that had
measured nothing was green, which is worse than a red one because a green check
is read as an answer.

`scanContrast` regions now take an optional `surface` — the colour a shell in
another file paints behind the tree, as a hex for a literal or as a TOKEN name
for a shell that paints `bg-background`, since the admin's surface differs
between the two colour schemes and a hex cannot say that. Declaring three of
them resolved 138 of the 150: the QR-game screens on `#120d1a`, the kitchen
display on `#0f172a`, and the admin on `SidebarInset`'s `bg-background`. The
twelve that remain are text over the hero photograph, which no static reading
can resolve and which the app suites now pin by filename, so a new unresolvable
surface fails instead of joining a silent pile.

That exposed 89 real failures. Two were faults in the scanner —
`cursor-not-allowed` is the other spelling of "inactive" beside
`pointer-events-none` and was not exempted under 1.4.3. The rest were four
habits: a raw Tailwind hue where `--success`/`--warning`/`--destructive` exists,
an opacity modifier on text (`text-muted-foreground/30` at 1.48:1), a chip
tinted with its own ink (`bg-amber-500/10 text-amber-500` at 1.95:1), and a
light-only palette pair read in dark mode (`text-orange-600` on
`bg-orange-50/50` at **1.109:1**). `SpiceLevelIndicator`'s unlit flames were
1.48:1, so a level of two out of five looked like two out of two.

Alongside them, `prefers-reduced-motion` reaches framer-motion for the first
time. The CSS block named `.animate-in` — one element in the app — and could
never have reached a library that writes inline `style` per frame, so the
preference applied to none of the ten `motion.*` elements on the buying path.
