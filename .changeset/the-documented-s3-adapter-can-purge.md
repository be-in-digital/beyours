---
"@be-in-digital/core": patch
"@be-in-digital/mcp-server": patch
---

Make the documented S3 adapter version-capable, so `S3Service.delete` can purge

`S3Service.delete` removes every version of a key. It can only do that through
the injected `S3Operations` adapter, and the two operations it needs —
`listObjectVersions` and `deleteObjectVersion` — are OPTIONAL on that interface.
An adapter without them compiles, runs, and returns
`{ outcome: 'delete-marker', reason: 'unsupported-adapter' }` on every single
delete: on the versioned bucket `setup-aws.sh` provisions, that keeps every
byte.

The adapter in `packages/core/src/aws/README.md` was such an adapter. It
declared four methods — `putObject`, `deleteObject`, `getSignedUrl`,
`headObject` — and neither version method, and it is the only concrete
`S3Operations` adapter in the repository: nothing in `apps/*` builds one, because
the delivered app's media path (`convex/cmsMediaDelete.ts`) talks to the AWS SDK
directly. So the purge shipped, was covered by four passing tests, and was
reachable by nobody who followed the documentation. Measured before this change,
through the documented adapter:

```
[PROBE] delete result: {"outcome":"delete-marker","versionsDeleted":0,"reason":"unsupported-adapter"}
[PROBE] commands sent: deleteObject
```

What changes:

- **`README.md`'s adapter implements all six operations**, including both
  arrays S3 returns (`Versions` and `DeleteMarkers` — a marker *is* a version,
  and reading only the first is how a purge leaves the markers behind) and the
  `IsTruncated` guard that stops the purge walking its page ceiling on every
  delete. The `delete` example now shows the three outcomes and says that only
  `purged` means the bytes are gone.
- **A guard on the document.** `s3-documented-adapter.test.ts` extracts the
  adapter from `README.md`, runs it against a stubbed SDK, and asserts the
  service reports `purged`. Remove either version method from the README and it
  goes red — the four existing purge tests would not have noticed, because what
  was missing was not the loop but a caller able to enter it.
- **The annotations that overstated are corrected.** `S3Operations`' docblock
  framed the fallback as a legacy minority case, when in this repository it was
  100% of executions; the `S3Service.delete` JSDoc did not say the optional
  methods gate the purge, nor that nothing in `apps/*` calls it;
  `IMPLEMENTATION.md` and the `createS3Service` entry in
  `@be-in-digital/mcp-server`'s registry still described the obsolete
  four-method interface.

No new dependency: `@be-in-digital/core` still has exactly one AWS SDK
dependency, `@aws-sdk/client-sesv2`. The adapter stays injected.

Refs #414 (OBS-2), #331.
