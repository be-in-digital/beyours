/**
 * The folders the product uploads to — the single source of truth.
 *
 * Kept free of the AWS SDK and of every other import so Convex actions can pull
 * it in without dragging the rest of the package into their bundle. Exposed as
 * `@be-yours/core/aws/folders`.
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

/**
 * Folders that hold what a person uploaded about themselves.
 *
 * The rest of the list is the restaurant's own published media — menu photos,
 * blog covers, branding — which the storefront has to render to a visitor who
 * has no session. `users/` and `avatars/` are the exception: they are the
 * account holder's face, posted from the storefront account page, and nothing
 * public renders them.
 *
 * Until #188 they were served by the same anonymous proxy as everything else,
 * protected only by a `crypto.randomUUID()` in the key and a bucket that grants
 * no `s3:ListBucket`. That is unguessable-URL secrecy, not access control: a
 * URL leaks through a referrer, a shared link, a support screenshot or a
 * database export, and there is no way to revoke it.
 *
 * Two names for one thing, deliberately kept apart: `users/` is what
 * `POST /api/upload` writes, `avatars/` is reachable through the presigned
 * Convex flow and appears in the CMS media library filter. Merging them would
 * strand the objects already under whichever name lost.
 */
export const PRIVATE_S3_FOLDERS = ['users', 'avatars'] as const

export type PrivateS3Folder = (typeof PRIVATE_S3_FOLDERS)[number]

/**
 * Whether reading this folder requires a session.
 *
 * Fails **closed** the other way round from `isKnownS3Folder`: an unrecognised
 * name is not private, because it is not servable either — the proxy has
 * already refused anything outside `S3_FOLDERS` by the time this is asked. Ask
 * both, in that order.
 */
export function isPrivateS3Folder(folder: string): folder is PrivateS3Folder {
  return (PRIVATE_S3_FOLDERS as readonly string[]).includes(folder)
}
