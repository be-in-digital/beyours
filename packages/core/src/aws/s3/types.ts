/**
 * ┌─────────────────────────────────────────────────────────────┐
 * │  📦 S3 Types                                                │
 * │  TypeScript interfaces for S3 operations, upload/download   │
 * │  results, presigned URLs, and object metadata               │
 * ├─────────────────────────────────────────────────────────────┤
 * │                                                             │
 * │  Usage:                                                     │
 * │  ┌───────────────────────────────────────────────────┐      │
 * │  │ import type { UploadOptions, UploadResult }       │      │
 * │  │   from '@be-yours/core'                           │      │
 * │  │                                                   │      │
 * │  │ const opts: UploadOptions = {                     │      │
 * │  │   folder: 'products',                             │      │
 * │  │   contentType: 'image/png',                       │      │
 * │  │ }                                                 │      │
 * │  └───────────────────────────────────────────────────┘      │
 * │                                                             │
 * └─────────────────────────────────────────────────────────────┘
 */

import type { S3Folder } from '../types'

/**
 * Parameters for the putObject operation
 */
export interface PutObjectParams {
  key: string
  body: Buffer | Uint8Array | Blob | string
  contentType?: string
  metadata?: Record<string, string>
}

/**
 * Parameters for the deleteObject operation
 */
export interface DeleteObjectParams {
  key: string
}

/**
 * One stored version of one key — a real object version, or the delete marker
 * that a versioned `DeleteObject` writes in place of removing anything.
 *
 * `isDeleteMarker` is what tells the two apart, and both have to be removed:
 * expiring only the versions leaves the marker, and expiring only the marker
 * un-deletes the file.
 */
export interface ObjectVersion {
  key: string
  versionId: string
  isDeleteMarker: boolean
}

/** Parameters for the listObjectVersions operation. */
export interface ListObjectVersionsParams {
  /**
   * Prefix to enumerate. S3 has no "versions of exactly this key" call — the
   * API is prefix-based — so `purge` passes the key and filters the result to
   * an exact match, because `cms/42.webp` is a prefix of `cms/42.webp.bak`.
   */
  prefix: string
  /** Continues a truncated listing. */
  keyMarker?: string
  versionIdMarker?: string
}

/** What one page of a version listing carries. */
export interface ListObjectVersionsResult {
  versions: ObjectVersion[]
  /** Set when S3 truncated the page; hand both back to continue. */
  nextKeyMarker?: string
  nextVersionIdMarker?: string
}

/** Parameters for deleting ONE version — the operation that frees bytes. */
export interface DeleteObjectVersionParams {
  key: string
  versionId: string
}

/**
 * Parameters for the getSignedUrl operation
 */
export interface GetSignedUrlParams {
  key: string
  expiresIn: number
  operation: 'putObject' | 'getObject'
}

/**
 * Parameters for the headObject operation
 */
export interface HeadObjectParams {
  key: string
}

/**
 * Metadata of an S3 object
 */
export interface ObjectMetadata {
  size: number
  contentType: string
  lastModified: Date
  metadata?: Record<string, string>
}

/**
 * Injectable interface over the S3 operations
 *
 * **Implement all six.** The two version operations are optional to the
 * compiler and mandatory in practice: the bucket `setup-aws.sh` provisions is
 * versioned, and on a versioned bucket a `DeleteObject` with no `VersionId`
 * deletes nothing. An adapter that stops at `headObject` type-checks, and then
 * every single `S3Service.delete` returns
 * `{ outcome: 'delete-marker', reason: 'unsupported-adapter' }` — the bytes
 * stay, billed and readable by anyone who can name a version id. That is not
 * a rare edge case; it is what happens to anyone who writes the four obvious
 * methods and stops. `packages/core/src/aws/README.md` has an adapter with all
 * six: copy it.
 *
 * They are optional rather than required for one reason, and it is about IAM,
 * not about what an adapter ought to do. `setup-aws.sh` granted
 * `s3:DeleteObject` and not `s3:DeleteObjectVersion` from the day the bucket
 * was created, so an already-provisioned client's IAM user can call one and not
 * the other. Making the methods required would have turned `S3Service.delete`
 * into a function that throws on every deployment in the field. Requiring them
 * becomes possible once every client has been re-provisioned.
 *
 * `delete` therefore purges versions when the adapter offers them and falls
 * back to the delete marker when it does not — and, crucially, SAYS WHICH.
 * See `S3Service.delete`.
 */
export interface S3Operations {
  putObject(params: PutObjectParams): Promise<void>
  deleteObject(params: DeleteObjectParams): Promise<void>
  getSignedUrl(params: GetSignedUrlParams): Promise<string>
  headObject(params: HeadObjectParams): Promise<ObjectMetadata>
  /** Enumerates every version and delete marker under a prefix. */
  listObjectVersions?(params: ListObjectVersionsParams): Promise<ListObjectVersionsResult>
  /** Removes ONE version. The only S3 call that actually frees bytes. */
  deleteObjectVersion?(params: DeleteObjectVersionParams): Promise<void>
}

/**
 * What `S3Service.delete` did.
 *
 * Returned rather than swallowed because the difference is the whole point:
 * `"purged"` means the bytes are gone, `"delete-marker"` means the object is
 * hidden and every byte of it is still billed and still readable by anyone who
 * can name a version id. An operator answering an erasure request needs to know
 * which one happened, and « définitivement supprimé » may only be said of the
 * first.
 */
export interface DeleteResult {
  outcome: 'purged' | 'delete-marker'
  /** Versions and delete markers actually removed. Zero on a fresh key. */
  versionsDeleted: number
  /**
   * Why the purge did not happen, when it did not. Either the adapter has no
   * version operations, or the listing was refused — which on a versioned
   * bucket means the IAM policy predates `s3:ListBucketVersions`.
   */
  reason?: 'unsupported-adapter' | 'listing-refused'
}

/**
 * Options for a file upload
 */
export interface UploadOptions {
  /** Destination folder */
  folder: S3Folder
  /** Custom filename (without extension) */
  filename?: string
  /** MIME type of the file */
  contentType: string
  /** Maximum allowed size in bytes */
  maxSize?: number
  /** Custom metadata */
  metadata?: Record<string, string>
}

/**
 * Result of an upload
 */
export interface UploadResult {
  /** S3 key of the file */
  key: string
  /** Public URL of the file */
  url: string
  /** File size in bytes */
  size: number
}

/**
 * Options for generating a presigned upload URL
 */
export interface PresignedUploadOptions {
  /** Destination folder */
  folder: S3Folder
  /** Custom filename (without extension) */
  filename?: string
  /** MIME type of the file */
  contentType: string
  /** Maximum allowed size in bytes */
  maxSize?: number
}

/**
 * Result of a presigned upload URL
 */
export interface PresignedUploadResult {
  /** URL to upload to */
  uploadUrl: string
  /** S3 key of the file */
  key: string
  /** Max allowed size in bytes (enforce client-side — presigned PUT does not support Content-Length-Range) */
  maxSize: number
  /** Expiry date */
  expiresAt: Date
}

/**
 * Result of a presigned download URL
 */
export interface PresignedDownloadResult {
  /** Download URL */
  downloadUrl: string
  /** Expiry date */
  expiresAt: Date
}
