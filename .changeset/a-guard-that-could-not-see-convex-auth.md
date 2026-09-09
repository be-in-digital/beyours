---
"@be-in-digital/convex-functions": patch
---

Let the Convex authorisation rule recognise Convex Auth's session lookup

`GUARD_SIGNALS` matched `/AuthUser\b/`, which is every Better Auth spelling the
engine uses and none of Convex Auth's: `getAuthUserId` continues into `Id`, so
the word boundary fails. Turning the rule on for `apps/site` — 68 publicly
callable functions that had never been linted — made forty-odd correctly guarded
queries read as `@guarded-inline` claiming something the rule could not see,
which is the failure mode that gets a guard switched off rather than obeyed.
