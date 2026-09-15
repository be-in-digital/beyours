---
"@be-in-digital/convex-functions": patch
---

`pnpm template:apply` no longer half-applies a template it is about to refuse.

The existence check sat inside the copy loop, one file at a time, so a template
missing its last source had already had `theme.css` and `fonts.ts` written over
it before the throw — the new template's colours and type over the old one's
layout, reached through an error telling the operator to fix something else.
Every source is checked before any is copied.

Found by writing the test `apply-template.test.mjs`'s own fixture had been citing
since #507 and which did not exist.
