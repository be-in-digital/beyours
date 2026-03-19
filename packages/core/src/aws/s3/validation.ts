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
 * │  │   from '@repo/core/aws'                           │      │
 * │  │                                                   │      │
 * │  │ validateMimeType('products', 'image/webp')        │      │
 * │  │ validateFileSize('products', 1024 * 500)          │      │
 * │  └───────────────────────────────────────────────────┘      │
 * │                                                             │
 * └─────────────────────────────────────────────────────────────┘
 */

import { z } from 'zod'
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZES } from '../types'
import type { S3Folder } from '../types'

/**
 * Schéma pour les dossiers S3
 */
export const s3FolderSchema = z.enum(['products', 'branding', 'stores', 'cms', 'email', 'users'])

/**
 * Schéma pour les options d'upload
 */
export const uploadOptionsSchema = z.object({
  folder: s3FolderSchema,
  filename: z.string()
    .regex(/^[a-zA-Z0-9._-]+$/, 'Le nom de fichier contient des caractères non autorisés')
    .optional(),
  contentType: z.string().min(1, 'Le type MIME est requis'),
  maxSize: z.number().positive().optional(),
  metadata: z.record(z.string()).optional(),
})

/**
 * Schéma pour les options d'URL presignée d'upload
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
 * Schéma pour une clé S3
 */
export const s3KeySchema = z.string()
  .min(1, 'La clé S3 est requise')
  .refine(
    (key) => !key.includes('..') && !key.startsWith('/') && !key.includes('//'),
    'La clé S3 contient des caractères non autorisés (path traversal)'
  )

/**
 * Valide le type MIME pour un dossier donné
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
 * Valide la taille d'un fichier
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
 * Extrait l'extension d'un type MIME
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
