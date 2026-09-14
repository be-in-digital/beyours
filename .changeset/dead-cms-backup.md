---
"@be-in-digital/convex-functions": patch
---

Stop backing up sixteen tables that cannot hold a row

`BACKUP_TABLES` carried all sixteen legacy `cms*` singletons — `cms`, `cmsHome`,
`cmsMenu`, `cmsAbout`, `cmsContact`, `cmsBlogPosts`, `cmsCart`, `cmsCheckout`,
`cmsTracking`, `cmsSignin`, `cmsSignup`, `cmsPrivacy`, `cmsTerms`, `cms404`,
`cmsMaintenance`, `cmsAccount` — on the reasoning that a backup without the pages
a client edits is not a backup of a website.

That was true of the CMS they were written for and is not true of the one that
shipped: all sixteen were superseded by the block-based `cmsPages` / `cmsBlocks` /
`cmsMedia`, and measure at zero reads, zero inserts and zero patches across the
functions package, each app's `convex` and each app's `components`. So the nightly
backup on every client deployment walked sixteen tables that cannot hold a row,
and a restore walked them again.

They move to `EXCLUDED_TABLES` with the reason rather than being dropped: the
coverage test requires every schema table to be in exactly one bucket, so an
omission cannot be silent. They stay declared in the schema because Convex refuses
a deploy that drops a table still holding rows, and nothing in this repository can
say whether a deployment provisioned two years ago still has one.

`privacy.ts` carried the same list for the same reason and lost it in #477; this
is the other half.
