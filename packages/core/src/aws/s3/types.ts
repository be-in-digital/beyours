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
 * Paramètres pour l'opération putObject
 */
export interface PutObjectParams {
  key: string
  body: Buffer | Uint8Array | Blob | string
  contentType?: string
  metadata?: Record<string, string>
}

/**
 * Paramètres pour l'opération deleteObject
 */
export interface DeleteObjectParams {
  key: string
}

/**
 * Paramètres pour l'opération getSignedUrl
 */
export interface GetSignedUrlParams {
  key: string
  expiresIn: number
  operation: 'putObject' | 'getObject'
}

/**
 * Paramètres pour l'opération headObject
 */
export interface HeadObjectParams {
  key: string
}

/**
 * Métadonnées d'un objet S3
 */
export interface ObjectMetadata {
  size: number
  contentType: string
  lastModified: Date
  metadata?: Record<string, string>
}

/**
 * Interface pour les opérations S3 (injectable)
 */
export interface S3Operations {
  putObject(params: PutObjectParams): Promise<void>
  deleteObject(params: DeleteObjectParams): Promise<void>
  getSignedUrl(params: GetSignedUrlParams): Promise<string>
  headObject(params: HeadObjectParams): Promise<ObjectMetadata>
}

/**
 * Options pour l'upload de fichiers
 */
export interface UploadOptions {
  /** Dossier de destination */
  folder: S3Folder
  /** Nom de fichier personnalisé (sans extension) */
  filename?: string
  /** Type MIME du fichier */
  contentType: string
  /** Taille maximale autorisée (bytes) */
  maxSize?: number
  /** Métadonnées personnalisées */
  metadata?: Record<string, string>
}

/**
 * Résultat d'un upload
 */
export interface UploadResult {
  /** Clé S3 du fichier */
  key: string
  /** URL publique du fichier */
  url: string
  /** Taille du fichier en bytes */
  size: number
}

/**
 * Options pour générer une URL presignée d'upload
 */
export interface PresignedUploadOptions {
  /** Dossier de destination */
  folder: S3Folder
  /** Nom de fichier personnalisé (sans extension) */
  filename?: string
  /** Type MIME du fichier */
  contentType: string
  /** Taille maximale autorisée (bytes) */
  maxSize?: number
}

/**
 * Résultat d'une URL presignée d'upload
 */
export interface PresignedUploadResult {
  /** URL pour l'upload */
  uploadUrl: string
  /** Clé S3 du fichier */
  key: string
  /** Date d'expiration */
  expiresAt: Date
}

/**
 * Résultat d'une URL presignée de téléchargement
 */
export interface PresignedDownloadResult {
  /** URL de téléchargement */
  downloadUrl: string
  /** Date d'expiration */
  expiresAt: Date
}
