---
"@be-in-digital/convex-functions": major
"@be-in-digital/convex-schema": major
"@be-in-digital/admin": minor
---

Stop a product deletion from breaking Deliveroo and bricking the menu that used it

`products.remove` was `handler: async (ctx, args) => { await ctx.db.delete(args.id) }`
and nothing else, while thirteen columns across nine tables pointed at
`products`. Two of them are REQUIRED — `externalProductMappings.internalProductId`
and `favorites.productId` — so those rows survived holding an id that resolves to
nothing and could not be repaired field by field. Measured before the fix:

```
menu still holds the dead id: ["10002;products"]
that product now resolves to: null
favorites rows left: 1, externalProductMappings rows left: 1
favorites[0].productId resolves to: null
```

**Deliveroo was told a deleted dish had synced.** Proven end to end through the
real signed webhook route, with only `globalThis.fetch` standing in for
Deliveroo's servers:

```
--- ordered dish was DELETED, its PLU was mapped ---
[Sync Debug] Item PLUs: Tiramisu:PLU-TIRAMISU
[Sync Debug] hasMissingPLU=false, hasMismatch=false
sync_status body: {"status":"succeeded","occurred_at":"..."}
```

`getByExternal` returned the surviving mapping without ever dereferencing
`internalProductId`, so the webhook's PLU loop counted zero unmatched items and
answered `sendSyncStatus(..., "succeeded")` for an order the kitchen cannot
cook. **And the formule became permanently uneditable**: `menus.update`
re-validates every stored section as a unit, so one dead id refused every
subsequent write — including the one removing that section.

**The decision is per referencing table, and it splits on authorship**, which is
the reasoning `categories.remove` already established: a cascade destroys an
afternoon's work on a click meant to tidy up.

- **Refused** while they point at the dish — `menus`, `promotions`, `prizes`.
  Each is a selling decision the owner made, and each has a screen to unmake it
  on. The refusal names them: *Ce produit est utilisé dans 1 formule : "Formule
  Midi".*
- **Cascaded** — `externalProductMappings` and `favorites` (machine-kept rows
  that mean nothing without the dish), `orphanProducts` (the platform match is
  void, so the import returns to `pending` for review), and the
  `linkedProductId` provenance link on twins in other establishments.
- **Left alone** — `orders.items[].productId`. What was sold is history, the
  column is already optional, and rewriting it would falsify the receipt.

`favorites` gained a `by_productId` index. Every index on that table started at
`userId`, so reaching the customers who favourited one dish would have meant
collecting the whole establishment's favourites inside a mutation that deletes a
single row — the same reason `by_storeId` was added to it for the store cascade.

The refusals are `ConvexError`, not plain `Error`: Convex redacts a plain
error's message in production, so a carefully counted refusal would have reached
the owner as "Server Error" and read as a bug in the product — the same
reasoning `auth.ts`'s `denied()` records. The products table was throwing that
sentence away too, showing a generic *Échec de la suppression du produit*; it
now shows the reason, through a `convexErrorMessage` reader added to this
package.

**`getByExternal` dereferences the product**, and keeps doing so after the
caller was fixed. `products.remove` can no longer create such a row, but a store
cascade, a restore or a hand-run mutation all arrive at this same query, and "we
have a mapping" must never outlive "we have the dish". `getByInternal` is
deliberately left alone: it is keyed on a product id the caller already holds,
so it cannot manufacture a match for a product nobody asked about.

**Two more routes to the same `succeeded` were found by an adversarial pass and
closed.** Both produce the identical customer-visible outcome, reached without
deleting anything.

The webhook accepted `pos_item_id` **or** `plu` **or** `external_reference_id`
as a POS identifier when testing for "no identifier at all", but the check that
looks the identifier up in our own mappings read `pos_item_id` alone. A line
identified by either of the other two skipped the database check entirely. All
four sites now resolve the identifier through one `posItemId()` helper, which
uses `||` rather than `??` because an empty string is not an identifier — with
`??` a line carrying `pos_item_id: ""` alongside a real `plu` stopped at the
empty one and a dish we can cook was refused.

And **the mapping lookup spanned the whole deployment.** A PLU is unique inside
one restaurant, not across an account, so an order for one establishment whose
PLU happened to be mapped in ANOTHER was answered as producible by a kitchen
that has never heard of the dish. The same span made `.unique()` throw the
moment two establishments shared a PLU string — which is exactly what a chain
running one menu across its locations does — and the caller counts a throw as an
unmatched item, so a correct multi-store deployment refused its own orders.
`getByExternal` now takes the establishment and reads a new
`by_store_platform_external` index. Both directions are pinned by tests that
were confirmed to fail without the change: the cross-tenant line answered
`succeeded`, and the shared-PLU chain answered `failed`.

**The store-cascade guard now sees foreign keys by type, not by name.** It read
`validator.fields.storeId` — the field literally called `storeId` — which is not
the same question as "what points at `stores`". Measured over the compiled
validators: 46 FK columns, 43 named `storeId`, three invisible. More to the
point, so was the next column somebody would call `restaurantId`, which is the
exact failure the guard exists to prevent. It now walks the serialised validator
by type and reports every path reaching `v.id("stores")`, however nested and
whatever it is called. Verified by injecting `restaurantId: v.optional(v.id("stores"))`
into an existing table: the guard fails, where the name filter passed it
silently.

Walking `validator.json` rather than the live validator objects is not a
preference — the two use different keys for the same thing (`type` vs `kind`),
and reading `.type` off a live node yields `undefined` for every field: a walk
that finds nothing and a test that passes.

That walk immediately found a live orphan. **`blogAutoConfig.targetStoreIds` is
now detached on store deletion**, by `detachStoreFromBlogAutoConfigs`. A config
belonging to establishment A that fans articles out to establishment B kept B's
dead id forever after B was deleted; only the config's own `storeId` was ever
handled. Every reference the guard finds must now be resolved either by the row
being swept or by a named entry in `DETACHED_STORE_REFERENCES` that says what
handles it — so a dangling id cannot be parked there to quiet the test.
`systemAuditLog.targetStoreId` is listed as dangling on purpose: the
`store_deleted` entry points at the store that was just deleted, and resolving
it would erase the record of the deletion.

**Breaking: the `printerSettings` table and `printerSettingsTable` export are
gone.** Ten required fields, zero readers and zero writers anywhere in the
repository since it was declared — the only reference outside the schema was the
delete cascade, removing rows nothing could ever create. Its own comment kept it
on the grounds that the planned thermal path would need "roughly" these fields,
but those fields are ESC/POS-shaped (`ipAddress`, `port`, `usbVendorId`,
`type: network | usb | bluetooth`) and that path is explicitly ruled out: the
thermal path when it comes is cloud printing, whose shape `stores.printConfig`
already carries. Auto-print runs on `stores.printConfig` today. Nothing can have
written a row, so nothing is lost. The documentation that described it — in
`CLAUDE.md`, both package READMEs, `STRUCTURE.md`, `EXAMPLES.md`, the docs app
and `IMPLEMENTATION_STEPS.md` — was corrected with it, including a `SUMMARY.md`
line advertising a `printerSettings.ts` function module that never existed.
