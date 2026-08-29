---
"@be-in-digital/convex-schema": minor
"@be-in-digital/convex-functions": minor
---

`orderConfirmation` and `displayConfig` are gone; `soundConfig` stays.

The audit listed three store settings as dead — "mutations and audit entries
wired, with no reader or writer". Two of the three were, and the reason they
looked wired is worth recording: the only screens that wrote them lived in
`apps/themes/components/admin/settings/`, a folder no route renders. Both apps
route `/dashboard/settings` and `/dashboard/stores/[id]` to `@be-in-digital/admin`,
so those six components had been orphaned and left behind. The folder is deleted.

`orderConfirmation` was the worse of the two. `"manual"` promised that staff
would validate an order before the kitchen saw it, and nothing implemented it:
`createWithTicket` sends every order straight through. A setting nobody reads is
dead code; a setting that promises a workflow the product does not have is a
false promise to the restaurant owner. It is withdrawn rather than left offered.

The two fields stay declared in the schema, optional, alongside `branding` and
the other legacy columns — a stored field absent from the schema fails
validation on the next write to that document, so removing them outright would
break the establishments that already hold one. Nothing writes them now.

`soundConfig` is **not** dead and is kept: `KitchenContent` hands it to
`KitchenSoundManager` in both apps, on the routed kitchen display, and it decides
which alerts sound and how loudly. Deleting it would have silenced a working
feature. It has no editor — the KDS runs on the component's fallbacks — which is
a gap worth closing and not the same thing.
