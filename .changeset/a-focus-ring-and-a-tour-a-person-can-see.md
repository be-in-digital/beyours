---
"@be-in-digital/ui": minor
"@be-in-digital/admin": patch
---

Render the focus ring at the opacity the guard measures, and pair the tour popover

The engine half of #436, which changed two published packages and shipped no
changeset with them. Without this the fixes below sit on `main` and reach no
client site — the templates in that PR travel by the mirror, but these do not.

**The focus indicator was below AA on every screen.** The token matrix in both
apps checks `--ring` at full opacity, and all twelve primitives rendered it as
`focus-visible:ring-ring/50` — shadcn's stylistic default, carried in
unexamined. Half a token is not half as visible: alpha composites toward the
page, so the measured ratio was not 5.03:1 but 2.13:1 in the light admin,
2.61:1 in the dark, 2.42:1 on the light storefront, against the 3:1 WCAG 1.4.11
asks of a control. Only the dark storefront cleared, at 3.09:1, and under a
vertical template it was worse — `pizzeria` measured 2.10:1. A keyboard user
could not see where they were. Accordion, Badge, Button, Checkbox, Input,
InputGroup, Select, Slider, Switch, Tabs and Textarea now render the token the
test already trusted.

This is a visible change: the ring is a solid 3px in the brand colour rather
than a soft wash. That is the point of it, and `--ring` is guaranteed to clear
3:1 against the page in all four scopes before it is drawn.

**`loadTokens` can read a cascade.** It read `app/globals.css` and stopped,
which measured the palette no delivered site runs — `app/layout.tsx` imports
`@/site/theme.css` after it. It takes an optional `overlays` argument now, so a
sweep can reproduce the stylesheet order a client actually gets. Additive: every
existing call is unchanged.

**The onboarding tour was white text on a white box.** `styles.popover` spread
reactour's `base` — a white background and no `color` — so the sentence
inherited `--foreground` from the admin above it. Fine in light mode at
20.147:1; near-white on white in dark, measured in Chromium at 1.045:1, over all
28 steps, for every owner whose machine is in dark mode. It now takes
`--popover`/`--popover-foreground`, so a theme moves both members together.
