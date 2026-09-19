---
'@be-yours/convex-functions': patch
'@be-yours/core': patch
---

Close three polynomial-regex denials of service

`normalizeSubscriberEmail` guarded a public newsletter signup with
`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. Both sides of the `\.` can themselves match a
dot, so the split is ambiguous and a domain that cannot match is retried from
every position — an internal space is enough, and `trim()` does not remove one.
Measured on `a@` + `x.`x40000 + ` z`: 1.0 s, quadrupling each time the input
doubles. The shape now excludes the dot from its labels, admitting exactly one
split, behind a 254-character bound from RFC 5321. `a@b..c` is refused where it
used to pass, an empty DNS label being no domain.

`media-url.ts` trimmed slashes with `replace(/\/+$/, '')` in two places.
Anchored at the end, the engine restarts the run at every position and walks to
the end each time: 80 000 slashes took 4.9 s, against 0.008 ms for the index
walk that replaces it. The values are `AWS_S3_PUBLIC_BASE_URL` and a pathname
parsed out of a caller's URL, so their length is not ours to assume.

Both were found by CodeQL, both predate the `@be-yours` rename, and neither is
behaviour-visible beyond the `a@b..c` correction.
