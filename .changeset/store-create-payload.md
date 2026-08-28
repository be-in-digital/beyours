---
"@be-in-digital/convex-functions": minor
"@be-in-digital/admin": patch
---

Creating an establishment from the dashboard works.

It never did. `stores.create` declares six arguments; the create dialog sent a
seventh — a `settings` object with currency, timezone, service toggles, fees and
a tax rate. Convex refuses an undeclared argument rather than dropping it, so
every attempt threw an `ArgumentValidationError` and the dialog showed nothing
but "Échec de la création de l'établissement". On a product billed per store,
the only establishments that could exist were the ones `seedFixture` wrote.

The payload now lives in `buildStoreCreateArgs` instead of inside the React
handler, because a payload written inline is invisible to the test suite. The
unit tests call handlers directly, past the validator, and saw nothing;
`store-create-args.test.ts` reads the argument names off the validator itself
and compares.

`resolveTaxRatePercent` loses its `storeTaxRate` source. It read
`store.settings.taxRate` — a legacy column no mutation declares, so the only
value it could ever have held came from the payload Convex was rejecting. Every
order already fell through to `globalSettings.taxRate`; the rate is now read
from there and nowhere else. A genuine per-store rate belongs in a declared
argument with an editor behind it.

`E2E_PORT` gives a Playwright run its own port. Two runs on one machine used to
share 3000, and `reuseExistingServer` let the second drive the first one's
build.
