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
 * │  │   from '@repo/core/aws'                           │      │
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
 */
export interface S3Operations {
  putObject(params: PutObjectParams): Promise<void>
  deleteObject(params: DeleteObjectParams): Promise<void>
  getSignedUrl(params: GetSignedUrlParams): Promise<string>
  headObject(params: HeadObjectParams): Promise<ObjectMetadata>
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
