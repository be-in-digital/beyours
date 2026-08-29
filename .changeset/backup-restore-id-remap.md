---
"@be-in-digital/convex-functions": minor
---

Restoring a backup no longer detaches the whole database from its stores.

`importTable` deletes a table and re-inserts its rows without their `_id` —
Convex will not let an insert choose one. So `stores` came back under **new**
ids while the products, menus, CMS pages and promotions restored after them came
back carrying the **old** `storeId`. Nothing objected: `v.id("stores")`
validates how an id is encoded, not that it resolves, so the inserts succeeded
and the deployment came up with every catalogue detached from its establishment.
`userProfiles.storeIds` still named stores that no longer existed, so the owner
who ran the restore was locked out of every screen. Silently, and irreversibly.

The import now records `old id → new id` for every row it inserts and carries
that map forward table by table, rewriting every id it recognises — including
inside arrays and nested objects, so `targetProductIds` and a CMS block's
embedded ids are reached as readily as a top-level `storeId`. The existing
dependency order is what makes it work: a reference can only be rewritten once
its target has been inserted.

`userProfiles` is not in the backup — it holds identities, not restaurant data —
so its `storeIds` are rewritten in place afterwards. Ids the map does not know
are dropped, because after the import those establishments do not exist, and
keeping them would put back the dangling reference this removes.

The restore reports what it remapped, and says plainly that orders, payments,
kitchen tickets and team members are neither exported nor imported, so their
references are not repaired. It does **not** try to count them: telling a
reference from an ordinary string needs a way to recognise a Convex id, and
there is none that holds across deployments. A count that reports zero for
exactly the case it exists to catch is worse than a plain statement of what a
backup carries.
