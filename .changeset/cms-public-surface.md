---
"@be-in-digital/convex-functions": patch
---

Stop an anonymous CMS read saying who is editing the page

Two findings from the CMS audit, resolving in opposite directions.

`cms.getPageBlocks` is the published page a visitor came to read, and it has no
session by design. Its `pageMeta` carried `hasUnpublishedChanges`,
`draftUpdatedAt` and **`updatedBy`** — editorial state and a staff user id — to
anybody who asked. Nothing on the storefront read any of the three: the
storefront's own type declared three fields and used none of them, while the
admin editor reads what it needs from the guarded `getAdminPageBlocks`. It is
**narrowed** to `hasPublished` and `publishedAt`: whether there is content, which
the caller sees anyway, and a publication date, which a page may legitimately
state about itself.

`cms.listPages` was registered public under `@public-by-design: published
storefront page content, no auth by design`. That annotation was wrong about the
payload — it returns `hasUnpublishedChanges` and `draftUpdatedAt` for every page
of the establishment, which is a list of what the staff are working on. Its only
caller in the repository is the admin's own content screen, so it is **guarded**
with `content:read` and no anonymous reader loses anything.
