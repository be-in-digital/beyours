---
"@be-in-digital/admin": patch
---

Bring the admin, the kitchen display and the QR game up to the AA floor

The token layer having been fixed, what was left were the colour literals that
never went through it. Measured by `tests/a11y/contrast.test.ts` over
`packages/admin/src`: **84 rendered foreground/background pairs below WCAG 2.1
AA**, each with a surface the sweep can resolve, so each one a real screen. They
fell into four families, and three of the four were a literal that had escaped
the design system.

**Status badges were painted by hand, and were blind to dark mode.** `bg-green-100
text-green-700` measured 4.497:1 — three thousandths under the floor, and
identical in dark mode because both halves are literals, so a pale green chip
sat on a near-black table. The stock badges, the team member's `En attente` /
`Expiré` / `Actif`, and the game catalogue's `Épuisé` now use the semantic pairs
the design system already had: `bg-success text-success-foreground` (5.19:1
light, 10.99:1 dark), `bg-warning text-warning-foreground` (5.40 / 9.43),
`bg-destructive text-destructive-foreground` (5.04 / 7.61). The two auth error
panels take `bg-destructive/5 text-destructive` (4.64 / 6.92), which is the
treatment the storefront settled on in the same issue.

**Two whole regions were dimmed with `opacity`, which is the trap #410 names.**
An untracked inventory row carried `opacity-50` and an out-of-stock prize card
`opacity-60`; an element opacity multiplies every ratio inside it, so the row's
"N/A" thumbnail placeholder measured **1.92:1** and the `Épuisé` badge —
which only ever renders on a card in that state — **3.29:1**. Both are now
tinted with `bg-muted` instead of faded, and the text inside them is back at
full strength (4.58:1 and 5.04:1). The prize ticket did the same to its QR
plate at `opacity-30`, taking the "QR indisponible" fallback to **1.29:1**; the
dimming moved onto the `<img>`, which is the thing that is actually spent.

**The QR management card asked a themed ink to be read on a fixed white.**
`--muted-foreground` inverts with the colour scheme and that plate does not, so
the placeholder icon measured 2.54:1 in dark mode. The white plate now exists
only under a QR code, where a scanner needs it.

**The game arena is a deliberate dark stage, and its labels had been softened
until they vanished.** `text-white/25` … `text-white/45` measure 2.4:1 to 4.5:1
on `#120d1a`, and less than that on the translucent panels the screens lay over
it; they are raised to `text-white/70` (9.54:1 on the stage, 8.08:1 on the
lightest panel). The gold CTA every screen ends on kept its
`from-amber-400 to-orange-600` gradient and lost its white label, which was
**1.72:1** on the gold end: the label is now the stage's own `#120d1a`, which
clears both ends (11.14:1 and 5.33:1). The printed ticket's `#1c1427` ink at
40–55% opacity — 2.53:1 to 3.93:1 on the cream — is raised to 70% (6.49:1), and
its `text-amber-600` eyebrow to `amber-700` (4.85:1). No French copy changed:
these are the screens a diner reads.

Three families keep a literal, deliberately, because a semantic token would
state something untrue: the kitchen display's blue → green → orange workflow
buttons (darkened one shade to `green-700` / `orange-700`, 4.94:1 and 5.23:1
for their white labels), and the Uber Eats / Deliveroo platform pills, whose
colours are the platforms' and not a status. Genuinely disabled controls are
left as they are, under the 1.4.3 exemption for inactive components.
