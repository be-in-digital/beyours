---
"@be-in-digital/core": minor
---

Make `S3Service.delete` remove every version, not write a delete marker

`setup-aws.sh` turns bucket **versioning** on, and on a versioned bucket
`DeleteObject` without a `VersionId` deletes nothing at all. It writes a *delete
marker* over the key and retains every prior version: still billed, still
readable by anyone who can name a version id, and invisible to an ordinary
listing. `client.deleteObject({ key })` was the whole of `delete()`, so
« définitivement supprimé » in the media library kept every byte, and the
offboarding runbook ticked an erasure box the infrastructure could not honour
(#331).

`delete()` now enumerates the key's versions and removes each one by id. Delete
markers go too, and by id: a marker *is* a version, so removing only the object
versions leaves the key hidden with its marker still billed, and removing only
the marker un-deletes the file. The listing is filtered to an exact key match
because the S3 API is prefix-based and `products/x.jpg` is a prefix of
`products/x.jpg.bak`.

`S3Operations` gains `listObjectVersions` and `deleteObjectVersion`, both
**optional**, and that is a deliberate compromise rather than an oversight:
`setup-aws.sh` has granted `s3:DeleteObject` and not `s3:DeleteObjectVersion`
since the bucket was created, so every already-provisioned client's IAM user can
call one and not the other. Making them required would have turned `delete()`
into a function that throws on every deployment in the field the day it shipped.

So `delete()` degrades instead — and says so. It returns a `DeleteResult` naming
what actually happened: `purged` with a version count, or `delete-marker` with
the reason (`unsupported-adapter`, or `listing-refused` when the IAM policy
predates `s3:ListBucketVersions`). A caller can then tell a client something
true, which is the entire point. **This changes the return type of `delete()`
from `void`**; existing callers that ignore it are unaffected.

The lifecycle rules that collect what a fallback leaves behind
(`NoncurrentVersionExpiration`, `ExpiredObjectDeleteMarker`) ship with the same
change in `scripts/setup-aws.sh`, along with the three version permissions.
Re-run that script for a client provisioned before it.

Refs #331.
