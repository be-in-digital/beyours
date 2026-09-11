---
"@be-in-digital/convex-functions": minor
"@be-in-digital/admin": minor
---

Make a catalogue translation run observable.

`translateCatalogue` has always written a `translationJobs` row and kept it up
to date — items completed, status, and the error when the daily quota stops a
run. Nothing read any of it, so a run that stopped at 80 of 300 looked exactly
like one that finished: the toast said « Traduction du catalogue lancée : 300
éléments » either way, and the first evidence anybody got was a German
storefront with French dish names on it.

`autoTranslate.listJobs` is the query, bounded and most-recent-first, and the
languages screen gains a « Traductions du catalogue » tab that renders it —
including the server's own sentence about the quota.
