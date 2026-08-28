/**
 * The folders the product uploads to — the single source of truth.
 *
 * Kept free of the AWS SDK and of every other import so Convex actions can pull
 * it in without dragging the rest of the package into their bundle. Exposed as
 * `@be-in-digital/core/aws/folders`.
 *
 * The bucket is private and `/api/files` is the read path, so this list is what
 * decides whether an uploaded object is reachable at all: the proxy serves a
 * folder only if it appears here. A folder accepted by an upload path but
 * missing from this list produces a URL that 404s — which is exactly how
 * category, blog and storefront images were lost.
 *
 * See `apps/docs/deployment/s3-bucket-policy.md`.
 *
 * @module aws/folders
 */

export const S3_FOLDERS = [
  'products',
  'categories',
  'cms',
  'branding',
  'stores',
  'storefront',
  'blogs',
  'blog-auto',
  'email',
  'avatars',
  'users',
] as const

export type S3Folder = (typeof S3_FOLDERS)[number]

/**
 * Whether a name is a folder the product knows about.
 *
 * Fails closed: an unrecognised name is refused, so a key cannot reach S3
 * through a folder nobody decided to support.
 */
export function isKnownS3Folder(folder: string): folder is S3Folder {
  return (S3_FOLDERS as readonly string[]).includes(folder)
}
