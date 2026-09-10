---
"@be-in-digital/convex-schema": minor
---

Read the restaurant's clock on Paris time when nothing has said which clock

`restaurantClock` fell back to `getUTCDay()` / `getUTCHours()` whenever it was
given no timezone. The timezone comes from `globalSettings.timezone`, and
`globalSettings` is a singleton the team writes — nothing seeds it — so a
deployment whose settings have never been saved passed `undefined` from every
call site and had its opening hours, its dish schedules and its happy hours all
enforced on the server clock. Convex runs in UTC.

Measured on the order path against a store open 11:00–14:00 with no settings
row: an order at 14:30 Paris was accepted and written to the kitchen, and one at
11:30 Paris — mid-service — was refused `outside_opening_hours`. Two hours of
every summer day taking orders after closing and refusing them during service.

`DEFAULT_RESTAURANT_TIMEZONE` is `Europe/Paris`, and it is the fallback for an
unusable timezone as well as an absent one — the reason that fallback existed
was that a settings row holding a typo must not close the whole catalogue, and
that is served better by the product's clock than by the server's. A deployment
that has set its timezone is unaffected: the default is the absence of an
answer, not a policy.

Nothing could see this. Every case in `order-opening-hours.test.ts` seeded the
settings row, which is the one thing that hides it, so the default is now pinned
beside the function that applies it in `__tests__/timeWindow.test.ts`, and the
order path carries two cases that omit the row.
