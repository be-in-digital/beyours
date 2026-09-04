---
"@be-in-digital/convex-functions": minor
---

Refuse a Stripe charge when the stored connection claims it is routed elsewhere

`convex/stripe.ts` builds its client from the PLATFORM secret key and sends no
`stripeAccount`, no `on_behalf_of` and no `transfer_data`, so every euro paid by
card lands in the platform balance. For a while the connect flow wrote
`paymentConnections.status: "connected"` the moment Stripe reported
`charges_enabled`, and the admin showed a green "Connecté" to an owner whose
takings were going somewhere else. The flow was corrected to write
`onboarding_complete`, the honest literal.

Nothing stopped the next person writing `"connected"` again. `grep -c
paymentConnections convex/stripe.ts` returned 0 — the charge path never read the
row at all, so the deception could come back with no test going red anywhere.

New subpath `@be-in-digital/convex-functions/stripeChargeRouting` exports
`resolveStripeCharge(connection)`. It throws for exactly one status —
`connected`, the literal whose meaning is "charges are routed to the connected
account" — and returns `{ mode: "platform" }` for `onboarding_complete`,
`disconnected`, `error` and no connection at all. Both Stripe money paths call
it: `createCheckoutSession` and `internalRefund`, before either reads the
platform key.

The rule is narrow on purpose, and the wide version is a trap. "Refuse whenever
a Stripe connection exists" would mean completing Connect onboarding breaks card
payments outright for that restaurant. `connected` is unreachable today, so
refusing it changes nothing about how anyone is charged — it is a tripwire, not
a behaviour change.

This is deliberately half of Stripe Connect. Routing the charge for real needs
two product decisions and a live Connect account; `tasks/stripe-connect-runbook.md`
holds that work.
