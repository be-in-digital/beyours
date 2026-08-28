/**
 * ┌─────────────────────────────────────────────────────────────┐
 * │  ☁️ S3 Client                                               │
 * │  File storage service with upload, presigned URLs,          │
 * │  download, delete, and metadata operations                  │
 * ├─────────────────────────────────────────────────────────────┤
 * │                                                             │
 * │  Usage:                                                     │
 * │  ┌───────────────────────────────────────────────────┐      │
 * │  │ import { createS3Service } from '@repo/core/aws'  │      │
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
   * Deletes a file from S3
   * @param key - S3 key of the file
   */
  delete(key: string): Promise<void>

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

      await client.deleteObject({ key })
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
