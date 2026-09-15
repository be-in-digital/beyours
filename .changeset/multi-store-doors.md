---
"@be-in-digital/admin": patch
---

Three features that existed everywhere except on a screen.

`PropagationModal` and `DuplicateCatalogModal` were exported from the products
barrel and rendered by nothing, while `products.updateWithPropagation` and
`products.duplicateCatalog` were live, guarded and tested in both apps — so
multi-store catalogue propagation could not be reached from any screen. The
duplicate modal is now a toolbar action on the products page, offered only to an
owner who has a second establishment; the propagation modal opens after a
successful product save, for the same owner.

`platformWebhookFailures.listUnresolved` and `markResolved` were wrapped and
guarded on `orders:read` with no screen at all, so an Uber Eats or Deliveroo
order that never became an order was written down and visible to nobody.
`WebhookFailuresPanel` renders the queue on the integrations tab.

`every-exported-screen-has-a-door.test.ts` holds the general case: a component
exported from a barrel in this package and rendered nowhere in the monorepo now
fails.
