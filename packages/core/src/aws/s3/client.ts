/**
 * ┌─────────────────────────────────────────────────────────────┐
 * │  ☁️ S3 Client                                               │
 * │  File storage service with upload, presigned URLs,          │
 * │  download, delete, and metadata operations                  │
 * ├─────────────────────────────────────────────────────────────┤
 * │                                                             │
 * │  Usage:                                                     │
 * │  ┌───────────────────────────────────────────────────┐      │
 * │  │ import { createS3Service } from '@be-yours/core'  │      │
 * │  │                                                   │      │
 * │  │ const s3 = createS3Service(config, client)        │      │
 * │  │ const { key, url } = await s3.upload(file, {      │      │
 * │  │   folder: 'products',                             │      │
 * │  │   contentType: 'image/webp',                      │      │
 * │  │ })                                                │      │
 * │  └───────────────────────────────────────────────────┘      │
 * │                                                             │
 * └─────────────────────────────────────────────────────────────┘
 */

import { randomUUID } from 'crypto'
import { type S3Config, MAX_FILE_SIZES } from '../types'
import { buildMediaUrl } from '../media-url'
import type {
  DeleteResult,
  ObjectVersion,
  S3Operations,
  UploadOptions,
  UploadResult,
  PresignedUploadOptions,
  PresignedUploadResult,
  PresignedDownloadResult,
  ObjectMetadata,
} from './types'
import {
  uploadOptionsSchema,
  presignedUploadOptionsSchema,
  s3KeySchema,
  validateMimeType,
  validateFileSize,
  getExtensionFromMimeType,
} from './validation'

/**
 * S3 service for file management
 */
export interface S3Service {
  /**
   * Uploads a file to S3
   * @param file - File contents
   * @param options - Upload options
   * @returns Details of the uploaded file
   */
  upload(
    file: Buffer | Uint8Array | Blob | string,
    options: UploadOptions
  ): Promise<UploadResult>

  /**
   * Generates a presigned URL for direct upload from the browser
   * @param options - Upload options
   * @returns The presigned URL and the file key
   */
  getPresignedUploadUrl(
    options: PresignedUploadOptions
  ): Promise<PresignedUploadResult>

  /**
   * Generates a presigned URL for download
   * @param key - S3 key of the file
   * @param expiresIn - Lifetime in seconds (default: 3600)
   * @returns The presigned download URL
   */
  getPresignedDownloadUrl(
    key: string,
    expiresIn?: number
  ): Promise<PresignedDownloadResult>

  /**
   * Removes a file from S3 — every version of it, on a versioned bucket.
   *
   * `setup-aws.sh` turns bucket versioning ON. On such a bucket a plain
   * `DeleteObject` **deletes nothing**: it writes a delete marker over the key
   * and retains every prior version, which stays billable and stays readable by
   * anyone who can name a version id. So « définitivement supprimé » in the
   * media library kept every byte, and an RGPD erasure request was answered
   * falsely — that is the defect this method exists to close.
   *
   * The purge enumerates the key's versions and removes each one by id — but
   * only when the injected `S3Operations` adapter implements
   * `listObjectVersions` and `deleteObjectVersion`. **Those two are optional on
   * the interface, so an adapter that omits them compiles and then never purges
   * anything.** The adapter in `packages/core/src/aws/README.md` implements
   * both; copy that one rather than writing the four obvious methods.
   *
   * When the adapter has no version operations, or when it has them and the IAM
   * policy of a previously provisioned client refuses the listing, this falls
   * back to the delete marker and REPORTS that it did, in the returned
   * `outcome`. A caller may then tell the truth about what happened instead of
   * inheriting the old lie.
   *
   * Nothing in `apps/*` calls this: the delivered app's media path is
   * `convex/cmsMediaDelete.ts`, which talks to the AWS SDK directly. This is
   * the path for a consumer of the package.
   *
   * @param key - S3 key of the file
   * @returns what actually happened, and how many versions went with it
   */
  delete(key: string): Promise<DeleteResult>

  /**
   * Builds the public URL of a file
   * @param key - S3 key of the file
   * @returns The public URL
   */
  getPublicUrl(key: string): string

  /**
   * Whether a file exists
   * @param key - S3 key of the file
   * @returns true when the file exists
   */
  exists(key: string): Promise<boolean>

  /**
   * Fetches the metadata of a file
   * @param key - S3 key of the file
   * @returns The file metadata
   */
  getMetadata(key: string): Promise<ObjectMetadata>
}

/**
 * Creates an S3 service instance
 * @param config - S3 configuration
 * @param client - Injectable S3 client
 * @returns The S3 service instance
 */
export function createS3Service(
  config: S3Config,
  client: S3Operations
): S3Service {
  const { publicBaseUrl } = config

  /**
   * Generates a unique S3 key
   */
  function generateKey(
    folder: string,
    contentType: string,
    filename?: string
  ): string {
    const extension = getExtensionFromMimeType(contentType)
    const name = filename ?? randomUUID()
    return `${folder}/${name}.${extension}`
  }

  /**
   * Builds the URL the browser should request for a stored object.
   * The bucket is private: this is either the CDN in front of it, or the
   * app's own `/api/files` proxy. See `aws/media-url`.
   */
  function buildPublicUrl(key: string): string {
    return buildMediaUrl(key, publicBaseUrl)
  }

  /**
   * Computes the size of a file
   */
  function getFileSize(file: Buffer | Uint8Array | Blob | string): number {
    if (typeof file === 'string') {
      return Buffer.byteLength(file, 'utf-8')
    }
    if (file instanceof Buffer || file instanceof Uint8Array) {
      return file.length
    }
    if (file instanceof Blob) {
      return file.size
    }
    throw new Error(`Unsupported file type: ${typeof file}`)
  }

  return {
    async upload(file, options) {
      // Validate the options
      const validatedOptions = uploadOptionsSchema.parse(options)
      const { folder, filename, contentType, maxSize, metadata } =
        validatedOptions

      // Validate the MIME type
      validateMimeType(folder, contentType)

      // Validate the size
      const size = getFileSize(file)
      validateFileSize(folder, size, maxSize)

      // Generate the key
      const key = generateKey(folder, contentType, filename)

      // Upload to S3
      await client.putObject({
        key,
        body: file,
        contentType,
        metadata,
      })

      return {
        key,
        url: buildPublicUrl(key),
        size,
      }
    },

    async getPresignedUploadUrl(options) {
      // Validate the options
      const validatedOptions = presignedUploadOptionsSchema.parse(options)
      const { folder, filename, contentType, maxSize } = validatedOptions

      // Validate the MIME type
      validateMimeType(folder, contentType)

      // Generate the key
      const key = generateKey(folder, contentType, filename)

      // Resolve the size limit: custom maxSize or the folder default
      const sizeLimit = maxSize ?? MAX_FILE_SIZES[folder]

      // Lifetime: 15 minutes
      const expiresIn = 15 * 60

      // NOTE: S3 presigned PUT URLs do not support Content-Length-Range.
      // The size limit is returned so the client can enforce it.
      // For server-side enforcement, move to presigned POST with policy conditions.
      const uploadUrl = await client.getSignedUrl({
        key,
        expiresIn,
        operation: 'putObject',
      })

      return {
        uploadUrl,
        key,
        maxSize: sizeLimit,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      }
    },

    async getPresignedDownloadUrl(key, expiresIn = 3600) {
      // Validate the key
      s3KeySchema.parse(key)

      // Generate the presigned URL
      const downloadUrl = await client.getSignedUrl({
        key,
        expiresIn,
        operation: 'getObject',
      })

      return {
        downloadUrl,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      }
    },

    async delete(key) {
      // Validate the key
      s3KeySchema.parse(key)

      const versions = await collectVersions(client, key)

      if (versions === null) {
        /* No version operations on this adapter. The delete marker is the best
           this client can do, and saying so is the point: the bytes are still
           there, and the lifecycle rules `setup-aws.sh` installs
           (`NoncurrentVersionExpiration` + `ExpiredObjectDeleteMarker`) are
           what eventually collect them. */
        await client.deleteObject({ key })
        return { outcome: 'delete-marker', versionsDeleted: 0, reason: 'unsupported-adapter' }
      }

      if (versions === 'refused') {
        await client.deleteObject({ key })
        return { outcome: 'delete-marker', versionsDeleted: 0, reason: 'listing-refused' }
      }

      /* Delete markers are deleted too, and by id. A delete marker IS a version:
         removing only the object versions leaves the key hidden but its marker
         billed, and removing only the marker un-deletes the file. */
      let versionsDeleted = 0
      for (const version of versions) {
        await client.deleteObjectVersion!({ key, versionId: version.versionId })
        versionsDeleted += 1
      }

      /* Unconditional, and not a tidy-up: between the listing above and this
         line another writer may have added a version, and on an unversioned
         bucket — or a suspended one — the listing legitimately comes back empty
         while the object exists. A `DeleteObject` costs nothing when there is
         nothing to delete. */
      await client.deleteObject({ key })

      return { outcome: 'purged', versionsDeleted }
    },

    getPublicUrl(key) {
      // Validate the key
      s3KeySchema.parse(key)

      return buildPublicUrl(key)
    },

    async exists(key) {
      // Validate the key
      s3KeySchema.parse(key)

      try {
        await client.headObject({ key })
        return true
      } catch (error) {
        return false
      }
    },

    async getMetadata(key) {
      // Validate the key
      s3KeySchema.parse(key)

      return await client.headObject({ key })
    },
  }
}

/** How many version pages one purge will walk before it gives up. */
const MAX_VERSION_PAGES = 100

/**
 * Every stored version of exactly one key, or why there is no list.
 *
 * `null` — the adapter has no version operations at all.
 * `'refused'` — the listing threw, which on a versioned bucket almost always
 * means the IAM policy predates `s3:ListBucketVersions`. Treated as "cannot
 * purge" rather than propagated: a delete that throws leaves the row deleted and
 * the object present with nobody told, which is strictly worse than a delete
 * marker plus an honest outcome.
 *
 * The result is filtered to an EXACT key match because the S3 API is
 * prefix-based and `cms/42.webp` is a prefix of `cms/42.webp.bak`. Purging by
 * prefix would delete a neighbouring file that merely starts with the same
 * characters.
 */
async function collectVersions(
  client: S3Operations,
  key: string
): Promise<ObjectVersion[] | null | 'refused'> {
  if (!client.listObjectVersions || !client.deleteObjectVersion) return null

  const found: ObjectVersion[] = []
  let keyMarker: string | undefined
  let versionIdMarker: string | undefined

  try {
    for (let page = 0; page < MAX_VERSION_PAGES; page += 1) {
      const result = await client.listObjectVersions({
        prefix: key,
        ...(keyMarker ? { keyMarker } : {}),
        ...(versionIdMarker ? { versionIdMarker } : {}),
      })

      for (const version of result.versions) {
        if (version.key === key) found.push(version)
      }

      if (!result.nextKeyMarker && !result.nextVersionIdMarker) return found
      keyMarker = result.nextKeyMarker
      versionIdMarker = result.nextVersionIdMarker
    }
  } catch {
    return 'refused'
  }

  /* A key with more than 100 pages of versions (S3 returns up to 1 000 per
     page) is not a photograph that was re-uploaded a few times; it is a runaway
     writer. Purging what was found is still right, and the ceiling stops one
     delete from running for the whole of an action's budget. */
  return found
}
