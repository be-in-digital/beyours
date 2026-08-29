---
"@be-in-digital/convex-functions": minor
"@be-in-digital/admin": patch
---

Two ways a store id reached somewhere it should not have.

**A stale admin selection no longer takes `/dashboard/team` down.** The persisted
id is a bare string in localStorage, and localStorage outlives the deployment
that issued it. `teamMembers.list` declares `storeId: v.id("stores")`, which
refuses an id from another deployment, and Convex raises that out of `useQuery`
during render — so the page went blank rather than degrading. `/dashboard/team`
is one of `StoreGuard`'s `BYPASS_ROUTES`, so it renders before the guard has
settled the selection; the guard does repair it, but a render happens first, and
one render was all it took. The page now checks the id against
`stores.listAll` before sending it, through the same `resolveStoreSelection` the
guard uses. This is the shape #119 fixed for the storefront and not here.

**A draft establishment is no longer readable by the storefront.**
`stores.getById` is public — checkout, the contact page and the open/closed
banner all need it before anyone signs in — and it returned drafts to anyone who
had an id: address, contact details, `orderMode`, `overrides`. `stores.list`
filters drafts out; a direct read walked past that.

Closing the query was not an option: it is also the administration's read. The
store detail page exists to publish drafts, and the KDS reads its own
establishment while holding a role (`kitchen`, `delivery`) that does not have
`stores:read`, so `getAdminById` is shut to it. The rule is therefore by caller —
staff see drafts, everyone else gets `null` — using a new non-throwing `isStaff`
beside `requireStaff`, because a query the storefront shares has to be able to
answer "not staff" without raising.
