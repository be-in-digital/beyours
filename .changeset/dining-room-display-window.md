---
"@be-in-digital/convex-functions": minor
"@be-in-digital/convex-schema": minor
"@be-in-digital/admin": minor
---

Give the dining-room screen a dismissal window the owner can set

`stores.displayConfig` decides how long a finished order stays on the
customer-facing screen in the dining room. `kitchenTickets.getForDisplay` has
read it since that screen shipped — `autoDismissEnabled` decides whether a ready
order is dropped at all, `autoDismissMinutes` how long it survives — and nothing
wrote it. Measured:

```
STORED  displayConfig -> {"autoDismissEnabled":false,"autoDismissMinutes":15}  ready count = 1
DEFAULT displayConfig -> {"autoDismissEnabled":true,"autoDismissMinutes":15}   ready count = 0
writers via db.patch|insert|replace : 0
readers of store.displayConfig      : 3
```

So every establishment ran on the query's own fallback: **an order the customer
is still waiting for disappeared from the wall they are watching, fifteen
minutes after the kitchen called it ready, with no setting anywhere to change
it.**

The mutation had been deleted, and the field filed under "legacy", on the claim
that nothing read the stored value. Three places in the repository stated that
claim — the schema comment, the `updateSoundConfig` docblock, and
`kitchen-sound-config.test.ts`, which certified it as a test — and the reader had
never gone away. All three are corrected. So are four more found alongside them:
both package CHANGELOGs (annotated rather than rewritten, as this repository's
convention has it), `kitchen-alerts.ts` and its test, which still said
`soundConfig` had no editor after #243 gave it one, and the audit line in
`tasks/sales-readiness-backlog.md` that the claim originally came from.

`updateDisplayConfig` is restored on the `updateSoundConfig` model, the field is
typed rather than `v.any()`, and the editor is a fifth **Écran de salle** card on
the kitchen tab, placed last because that tab is ordered as a service runs
through it and the dining-room screen is downstream of everything.

**The mutation refuses a window it cannot honour.** `v.number()` accepts `NaN`,
`Infinity`, zero and negatives, and `getForDisplay` turns whatever is stored into
`readyAt > now - minutes * 60_000`: `NaN` makes every comparison false, zero and
negatives keep only tickets that became ready in the future — each of them
emptying the ready column, which is the failure this setting exists to prevent,
reached from the other side. `Infinity` is the odd one out, measured rather than
assumed: it stores and round-trips, and quietly becomes a second, undeclared way
to say "never dismiss" when `autoDismissEnabled: false` is the declared one. All
are refused rather than clamped — silently storing a number other than the one
sent is how a setting comes to disagree with the screen it governs, and it would
put a value nobody typed into the audit trail. The editor clamps its own input to
the same range, and a test pins the two ranges together so they cannot drift.
