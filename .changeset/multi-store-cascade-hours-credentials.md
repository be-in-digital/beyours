---
"@be-in-digital/convex-functions": minor
"@be-in-digital/convex-schema": minor
"@be-in-digital/restaurant": minor
"@be-in-digital/admin": patch
---

Four multi-store defects, all of them settings written by the dashboard and
read by nobody — or data written and never cleaned up.

**Deleting an establishment takes its data with it.** `stores.remove` deleted
the store row alone. Forty-two `storeId` columns across twenty tables were left
pointing at a document that no longer existed, and the id stayed in
`userProfiles.storeIds`. Nothing complained: `v.id("stores")` validates how an
id is encoded, not that it resolves. The sweep is batched and resumable — one
mutation is one transaction, and an established restaurant has more orders than
a transaction may touch — so `remove` clears one batch and the app wrapper
schedules `purgeStoreData` until there is nothing left. `favorites` gained a
`by_storeId` index: both of its compound indexes start with `userId`, so it was
the one table that could not be swept by store.

**"Horaires globaux" governs the storefront.** `useGlobalHours` was written by
the dashboard and read by nothing — `use-store-status` took `store.hours`
unconditionally, so an owner who edited the global week and left every location
on the flag changed nothing a visitor could see. `resolveStoreHours` resolves it
on read rather than copying on write, so editing the global hours reaches every
location that follows them without a migration.

**Opening hours are the restaurant's, not the visitor's.**
`globalSettings.timezone` was written and never read: open/closed came from
`now.getDay()` and `now.getHours()`, the browser's clock. A customer abroad got
the wrong answer, and anyone could change it by changing their system clock.
`isStoreOpen` and `getNextOpenTime` take an optional IANA zone; without one they
behave exactly as before, and an unknown zone name falls back to the visitor's
clock rather than throwing.

**Saving the Integrations tab keeps the Uber Direct credentials.** The settings
form read `globalSettings.get` — the public storefront query, which strips
`customerId`, `clientId` and `clientSecret` — so the fields came up empty and
saving patched the empty values over the stored ones. It reads `getAdmin` now,
the query behind the same `settings:read` the Paramètres page already requires.
`upsert` also merges `integrations` platform by platform, so a tab saving its
own section no longer takes out the others; each platform is still replaced
whole, so disconnecting one remains possible.

The three integration switches gained an id and an `aria-label`. They had
neither, so a screen reader announced three anonymous check boxes.
