/**
 * Types partagés pour les services AWS
 * @module aws/types
 */

/**
 * Configuration de base AWS
 */
export interface AWSConfig {
  /** Région AWS (ex: eu-west-1) */
  region: string
  /** Clé d'accès AWS */
  accessKeyId: string
  /** Clé secrète AWS */
  secretAccessKey: string
}

/**
 * Configuration pour S3
 */
export interface S3Config extends AWSConfig {
  /** Nom du bucket S3 */
  bucketName: string
  /** URL de base publique (CloudFront ou S3 public URL) */
  publicBaseUrl?: string
}

/**
 * Configuration pour SES
 */
export interface SESConfig extends AWSConfig {
  /** Email expéditeur */
  fromEmail: string
  /** Nom de l'expéditeur */
  fromName?: string
  /** Email de réponse */
  replyToEmail?: string
}

/**
 * Dossiers autorisés pour le stockage S3
 */
export type S3Folder = 'products' | 'branding' | 'stores' | 'cms' | 'games' | 'email'

/**
 * Types MIME autorisés
 */
export const ALLOWED_MIME_TYPES: Record<S3Folder, string[]> = {
  products: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ],
  branding: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ],
  stores: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
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
  games: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ],
} as const

/**
 * Tailles maximales par dossier (en bytes)
 */
export const MAX_FILE_SIZES: Record<S3Folder, number> = {
  products: 10 * 1024 * 1024, // 10MB
  branding: 10 * 1024 * 1024, // 10MB
  stores: 10 * 1024 * 1024, // 10MB
  cms: 100 * 1024 * 1024, // 100MB (videos can be large)
  games: 10 * 1024 * 1024, // 10MB
  email: 10 * 1024 * 1024, // 10MB
} as const
