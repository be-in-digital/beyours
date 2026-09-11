---
"@be-in-digital/convex-functions": patch
"@be-in-digital/convex-schema": patch
"@be-in-digital/admin": patch
---

Stop an erasure report asking for a check that cannot find anything.

Sixteen legacy `cms*` singletons have no reader and no writer anywhere in the
product. `privacy.ts` listed `cmsHome` as a diner table and ended **every**
erasure with an instruction to check the homepage testimonials by hand — for
testimonials that do not exist and cannot.

Worse than noise on a document an establishment answers a subject request with:
it makes every erasure read as incomplete, and an operator who checks and finds
nothing learns to skip the notes, including the four that are real.

The tables stay declared, and the schema now says why: Convex refuses a deploy
that drops a table while documents exist, and "zero writers in this repository"
is a measurement of the code rather than of any client's data.
