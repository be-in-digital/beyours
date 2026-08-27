---
"@be-in-digital/convex-functions": patch
---

Creating an establishment now makes its creator an administrator of it.

`stores.create` is the one mutation the store-scoped seam cannot guard — there
is no store yet to check membership against — and nothing added the new store to
the creator's profile. A client admin who opened a second location was refused
by the detail page and every edit, and `profileProvisioning` refused them their
own profile too, so only a super admin could let them back in.
