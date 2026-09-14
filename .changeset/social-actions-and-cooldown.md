---
"@be-in-digital/convex-functions": minor
"@be-in-digital/admin": minor
---

Stop calling a countdown a verification, and let the cooldown be configured

**Two claims the gamification screens made that the product could not keep.**

The diner was shown « Vérification… 12s » while a countdown ran, and the owner
configured a field labelled « Durée de vérification (s) ». Nothing was verified in
either case: the product opens a link and counts seconds. It cannot be verified
either — Google's Places API exposes the reviews of a place, not the identity of
the device that left one, and neither Instagram nor Facebook offers a follow-check
for a visitor with no account link. So the fix is the words: the countdown is a
dwell timer, the action is the diner's own declaration, and both screens say so.
This is not only honesty — an owner sets the win ratio, and therefore the prize
budget, against what they believe the actions guarantee.

`games.config.cooldownHours` was in the schema and read by `cooldownMsForGame`,
and **no screen wrote it**: the admin declared it in a TypeScript interface and
rendered nothing. Every game on every deployment was stuck on the 24-hour default.
It is a control on the game card now, clamped by `resolveCooldownHours` — which is
what the player path calls too, so the number shown is the number the game
honours. Zero means no wait, which is a real choice and a survivable one: the
cooldown is fairness between honest devices, while `consumeRateLimit` bounds the
rate and `prizeBudget` bounds the cost.
