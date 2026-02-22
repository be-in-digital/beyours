/**
 * AWS Services integration (S3 + SES)
 *
 * Re-exports AWS utilities from @beindigital-engine/core
 * for file storage and email functionality.
 *
 * @example
 * ```ts
 * // S3 Usage
 * import { createS3Service } from '@/lib/aws'
 *
 * const s3 = createS3Service(config, s3Client)
 * const url = await s3.uploadFile(file, 'products')
 *
 * // SES Usage
 * import { createSESService } from '@/lib/aws'
 *
 * const ses = createSESService(config, sesClient)
 * await ses.sendEmail({ to: 'user@example.com', subject: 'Hello', html: '<p>Hi!</p>' })
 * ```
 */

// ============================================================================
// Types
// ============================================================================
export type {
  AWSConfig,
  S3Config,
  SESConfig,
  S3Folder,
} from '@beindigital-engine/core'

export {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZES,
} from '@beindigital-engine/core'

// ============================================================================
// S3 Service
// ============================================================================
export type {
  S3Service,
  S3Operations,
  UploadOptions,
  UploadResult,
  PresignedUploadOptions,
  PresignedUploadResult,
  PresignedDownloadResult,
  ObjectMetadata,
  PutObjectParams,
  DeleteObjectParams,
  GetSignedUrlParams,
  HeadObjectParams,
} from '@beindigital-engine/core'

export {
  createS3Service,
  createS3Operations,
  getS3Config,
  getS3Service,
  validateMimeType,
  validateFileSize,
  getExtensionFromMimeType,
} from '@beindigital-engine/core'

// ============================================================================
// SES Service
// ============================================================================
export type {
  SESService,
  SendEmailParams,
  SendEmailResult,
  SendTemplatedEmailParams,
  SendBulkEmailParams,
  SendBulkEmailResult,
  SESOperations,
} from '@beindigital-engine/core'

export {
  createSESService,
} from '@beindigital-engine/core'

// ============================================================================
// Email Templates
// ============================================================================
export type {
  EmailTemplate,
  OrderConfirmationData,
  SESPasswordResetData,
  WelcomeData,
  PrizeWonData,
  TemplateName,
} from '@beindigital-engine/core'

export {
  orderConfirmationTemplate,
  passwordResetTemplate,
  welcomeTemplate,
  prizeWonTemplate,
  sesEmailTemplates,
  getTemplate,
} from '@beindigital-engine/core'
