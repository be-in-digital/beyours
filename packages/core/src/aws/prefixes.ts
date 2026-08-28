/**
 * S3 prefix visibility — the single source of truth.
 *
 * Kept in its own module, free of the AWS SDK and of every other import, so
 * that Convex actions can pull it in without dragging the rest of the package
 * into their bundle. Exposed as `@be-in-digital/core/aws/prefixes`.
 *
 * The decision this encodes is recorded in
 * `apps/docs/deployment/s3-bucket-policy.md`.
 *
 * @module aws/prefixes
 */

/**
 * Folders whose objects are readable anonymously.
 *
 * These are marketing assets: browsers, social crawlers and mail clients fetch
 * them without ever holding a credential. They are granted `s3:GetObject` by
 * bucket policy and addressed through `AWS_S3_PUBLIC_BASE_URL`.
 *
 * This list and the bucket policy in `scripts/setup-aws.sh` must stay in step.
 */
export const PUBLIC_S3_FOLDERS = [
  'products',
  'categories',
  'cms',
  'branding',
  'stores',
  'storefront',
  'blogs',
  'blog-auto',
  'email',
] as const

/**
 * Folders whose objects are never readable anonymously.
 *
 * These hold what a customer uploads about themselves. They are excluded from
 * the bucket policy, so the authenticated `/api/files` proxy is their only read
 * path — they are never given a direct S3 or CDN URL.
 */
export const PRIVATE_S3_FOLDERS = ['avatars', 'users'] as const

/**
 * Every folder an upload may target.
 */
export const S3_FOLDERS = [...PUBLIC_S3_FOLDERS, ...PRIVATE_S3_FOLDERS] as const

export type PublicS3Folder = (typeof PUBLIC_S3_FOLDERS)[number]
export type PrivateS3Folder = (typeof PRIVATE_S3_FOLDERS)[number]
export type S3Folder = (typeof S3_FOLDERS)[number]

/**
 * Whether an S3 key sits under a publicly readable prefix.
 *
 * Fails closed: an unrecognised prefix is treated as private, so adding a
 * folder without deciding its visibility cannot silently publish it.
 */
export function isPublicS3Key(key: string): boolean {
  const folder = key.split('/')[0] ?? ''
  return (PUBLIC_S3_FOLDERS as readonly string[]).includes(folder)
}

/**
 * Whether a folder name is one the product knows about.
 */
export function isKnownS3Folder(folder: string): folder is S3Folder {
  return (S3_FOLDERS as readonly string[]).includes(folder)
}

/**
 * The URL an uploaded object should be addressed by.
 *
 * Public objects resolve to the CDN origin; private ones resolve to the
 * authenticated proxy. Callers must persist this rather than building an S3
 * URL themselves, so that a prefix's visibility is decided in exactly one
 * place.
 *
 * `publicBaseUrl` is required for public keys. It is passed in rather than read
 * from `process.env` here so this module stays usable in every runtime.
 */
export function buildAssetUrl(
  key: string,
  publicBaseUrl: string | undefined,
  fallbackS3Origin?: string,
): string {
  if (!isPublicS3Key(key)) {
    return `/api/files/${key}`
  }
  const base = publicBaseUrl?.replace(/\/+$/, '') || fallbackS3Origin?.replace(/\/+$/, '')
  if (!base) {
    throw new Error(
      `AWS_S3_PUBLIC_BASE_URL is required to build a URL for the public key "${key}". ` +
        'See apps/docs/deployment/s3-bucket-policy.md.',
    )
  }
  return `${base}/${key}`
}
