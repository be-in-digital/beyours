---
"@be-in-digital/core": minor
---

Make S3 prefix visibility explicit, and stop private objects being readable

The product shipped two contradictory assumptions about its bucket: sixteen
Convex modules built a direct `https://<bucket>.s3.<region>.amazonaws.com/...`
URL commented as "bucket policy allows public reads", while the upload route
built a proxy path commented as "the S3 bucket is not publicly accessible". The
decision recorded in `apps/docs/deployment/s3-bucket-policy.md` settles it: the
bucket is private, public read is granted by bucket policy to a fixed list of
asset prefixes, and everything else is served through an authenticated proxy.

- New `@be-in-digital/core/aws/prefixes` subpath — `PUBLIC_S3_FOLDERS`,
  `PRIVATE_S3_FOLDERS`, `S3_FOLDERS`, `isPublicS3Key`, `isKnownS3Folder` and
  `buildAssetUrl`. It is free of the AWS SDK so Convex actions can import it
  without pulling the package into their bundle. `isPublicS3Key` fails closed:
  an unrecognised prefix is private, so adding a folder cannot silently publish
  it.
- `S3Folder` grows from six names to eleven, reconciling three allowlists that
  had drifted apart. `ALLOWED_MIME_TYPES` and `MAX_FILE_SIZES` cover all of
  them. `categories`, `storefront`, `blogs` and `blog-auto` were uploadable but
  absent from the bucket policy, so those images returned 403 on any bucket
  built by `setup-aws.sh`.
- `AWS_S3_PUBLIC_BASE_URL` is validated, and required whenever
  `AWS_S3_BUCKET_NAME` is set. Asset URLs are persisted, so an unset origin
  writes raw S3 URLs into the database permanently — setting the variable later
  does not repair them, which is why this is caught at startup.
