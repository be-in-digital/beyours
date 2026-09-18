---
"@be-yours/convex-schema": major
"@be-yours/convex-functions": major
"@be-yours/integrations": major
"@be-yours/marketing": major
"@be-yours/mcp-server": major
"@be-yours/restaurant": major
"@be-yours/admin": major
"@be-yours/core": major
"@be-yours/cms": major
"@be-yours/ui": major
---

Move the engine scope from `@be-in-digital/*` to `@be-yours/*`.

The repository moved to the `be-yours` GitHub organisation, and GitHub Packages
binds an npm scope to the account that owns the repository, so the scope had to
follow. There is no way to publish `@be-in-digital/core` from a repository the
`be-in-digital` organisation no longer owns.

This is breaking for every consumer, which is why all ten packages take a major
even where no source line changed: an installed site resolves
`@be-in-digital/core` and will not find the successor by itself. The rename in a
client site is mechanical and `scripts/migrate-scope-to-be-yours.mjs` performs
it — it matches the hyphenated spelling only, so the identifiers registered
outside the repository (`.beindigital-site.json`, the `beindigital-*`
`localStorage` keys, the SES configuration set, the Uber Eats brand id, the
Unsplash `utm_source`, the mobile bundle id) are untouched by construction.
`tasks/beyours-org-migration.md` carries the order of operations, including the
parts that are not code.

Versions already published under `@be-in-digital/*` stay resolvable while that
organisation exists; nothing is unpublished. What ends is publishing to it. The
CHANGELOG entries and the 125 `@be-in-digital/<pkg>@<version>` git tags are left
as they are — they record which version shipped under which scope, and that
history stayed true through the previous scope rename
(`@beindigital-engine` → `@be-in-digital`, changeset `1a5ca27`).
