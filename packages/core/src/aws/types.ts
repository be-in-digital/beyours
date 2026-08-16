/**
 * Shared types for the AWS services
 * @module aws/types
 */

/**
 * Base AWS configuration
 */
export interface AWSConfig {
  /** AWS region (e.g. eu-west-1) */
  region: string
  /** AWS access key ID */
  accessKeyId: string
  /** AWS secret access key */
  secretAccessKey: string
}

/**
 * S3 configuration
 */
export interface S3Config extends AWSConfig {
  /** S3 bucket name */
  bucketName: string
  /** Public base URL (CloudFront or the public S3 URL) */
  publicBaseUrl?: string
}

/**
 * SES configuration
 */
export interface SESConfig extends AWSConfig {
  /** Sender email address */
  fromEmail: string
  /** Sender display name */
  fromName?: string
  /** Reply-to address */
  replyToEmail?: string
}

/**
 * Folders allowed for S3 storage
 */
export type S3Folder = 'products' | 'branding' | 'stores' | 'cms' | 'email' | 'users'

/**
 * Allowed MIME types
 */
export const ALLOWED_MIME_TYPES: Record<S3Folder, string[]> = {
  products: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/svg+xml',
  ],
  branding: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/svg+xml',
  ],
  stores: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/svg+xml',
  ],
  cms: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/svg+xml',
    'video/mp4',
    'video/webm',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  email: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
  ],
  users: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ],
} as const

/**
 * Maximum file size per folder, in bytes
 */
export const MAX_FILE_SIZES: Record<S3Folder, number> = {
  products: 10 * 1024 * 1024, // 10MB
  branding: 10 * 1024 * 1024, // 10MB
  stores: 10 * 1024 * 1024, // 10MB
  cms: 100 * 1024 * 1024, // 100MB (videos can be large)
  email: 10 * 1024 * 1024, // 10MB
  users: 5 * 1024 * 1024, // 5MB
} as const
