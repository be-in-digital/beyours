/**
 * ┌─────────────────────────────────────────────────────────────┐
 * │  ✅ S3 Validation                                           │
 * │  Zod schemas and helpers for S3 upload validation           │
 * │  MIME types, file sizes, folder rules, key format           │
 * ├─────────────────────────────────────────────────────────────┤
 * │                                                             │
 * │  Usage:                                                     │
 * │  ┌───────────────────────────────────────────────────┐      │
 * │  │ import { validateMimeType, validateFileSize }     │      │
 * │  │   from '@be-in-digital/core'                           │      │
 * │  │                                                   │      │
 * │  │ validateMimeType('products', 'image/webp')        │      │
 * │  │ validateFileSize('products', 1024 * 500)          │      │
 * │  └───────────────────────────────────────────────────┘      │
 * │                                                             │
 * └─────────────────────────────────────────────────────────────┘
 */

import { z } from 'zod'
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZES, S3_FOLDERS } from '../types'
import type { S3Folder } from '../types'

/**
 * The folders an upload may target.
 *
 * Derived from `S3_FOLDERS`, never restated. It used to be a hand-written
 * `z.enum` of six, and the list grew to eleven without it: `upload()` and
 * `getPresignedUploadUrl()` both parse through this schema, so
 * `categories`, `storefront`, `blogs`, `blog-auto` and `avatars` type-checked
 * as `S3Folder` and threw at runtime. Deriving it makes that drift
 * unrepresentable.
 *
 * This is the whole set on purpose. A path that means to accept fewer — the
 * HTTP route in `apps/*\/app/api/upload/route.ts` takes five, because the rest
 * are written by the presigned Convex flow under its own authorisation —
 * narrows it at that path, where the reason for narrowing is visible. It does
 * not narrow it here, where every caller would silently inherit it.
 */
export const s3FolderSchema = z.enum(S3_FOLDERS)

/**
 * Schema for the upload options
 */
export const uploadOptionsSchema = z.object({
  folder: s3FolderSchema,
  filename: z.string()
    .regex(/^[a-zA-Z0-9._-]+$/, 'Le nom de fichier contient des caractères non autorisés')
    .optional(),
  contentType: z.string().min(1, 'Le type MIME est requis'),
  maxSize: z.number().positive().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
})

/**
 * Schema for the presigned upload URL options
 */
export const presignedUploadOptionsSchema = z.object({
  folder: s3FolderSchema,
  filename: z.string()
    .regex(/^[a-zA-Z0-9._-]+$/, 'Le nom de fichier contient des caractères non autorisés')
    .optional(),
  contentType: z.string().min(1, 'Le type MIME est requis'),
  maxSize: z.number().positive().optional(),
})

/**
 * Schema for an S3 key
 */
export const s3KeySchema = z.string()
  .min(1, 'La clé S3 est requise')
  .refine(
    (key) => !key.includes('..') && !key.startsWith('/') && !key.includes('//'),
    'La clé S3 contient des caractères non autorisés (path traversal)'
  )

/**
 * Validates the MIME type against a given folder
 */
export function validateMimeType(folder: S3Folder, contentType: string): void {
  const allowedTypes = ALLOWED_MIME_TYPES[folder]

  if (!allowedTypes.includes(contentType)) {
    throw new Error(
      `Type MIME non autorisé pour le dossier "${folder}". Types acceptés: ${allowedTypes.join(', ')}`
    )
  }
}

/**
 * Validates a file size
 */
export function validateFileSize(
  folder: S3Folder,
  size: number,
  maxSize?: number
): void {
  const limit = maxSize ?? MAX_FILE_SIZES[folder]

  if (size > limit) {
    const limitMB = (limit / (1024 * 1024)).toFixed(2)
    const sizeMB = (size / (1024 * 1024)).toFixed(2)
    throw new Error(
      `Fichier trop volumineux (${sizeMB}MB). Taille maximale: ${limitMB}MB`
    )
  }
}

/**
 * Maps a MIME type to its file extension
 */
export function getExtensionFromMimeType(contentType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  }

  return mimeToExt[contentType] || 'bin'
}
