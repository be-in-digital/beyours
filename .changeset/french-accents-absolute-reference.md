---
"@be-in-digital/admin": patch
"@be-in-digital/convex-functions": patch
"@be-in-digital/convex-schema": patch
---

Restore the accents on French copy that the twin comparison could not see

The accent guard compared `apps/reference` against `apps/themes`, so a word
de-accented identically in both was invisible to it: "doit etre dans le futur",
"n'est pas configure" and "l'import reel" all passed a green check. It now
measures each string against a list of French spellings instead of against the
other app, which does not care how many copies of a fault exist.

That found 128 de-accented words across 40 files, all of them user-facing:
"Article supprime", "Commande acceptee sur Uber Eats", "Publiee le",
"La quantite doit etre positive", "Selectionnez au moins un element a migrer".
Validator messages, kitchen tickets, the blog editor and the system pages are
all affected, and the strings ship to every client.

`createMigrationRequest`'s test asserted the misspelling (`/au moins un
element/`), so it has been rewritten to assert the corrected message.
