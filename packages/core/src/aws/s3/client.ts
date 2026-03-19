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
import type { S3Config } from '../types'
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
 * Service S3 pour la gestion des fichiers
 */
export interface S3Service {
  /**
   * Upload un fichier vers S3
   * @param file - Contenu du fichier
   * @param options - Options d'upload
   * @returns Informations sur le fichier uploadé
   */
  upload(
    file: Buffer | Uint8Array | Blob | string,
    options: UploadOptions
  ): Promise<UploadResult>

  /**
   * Génère une URL presignée pour l'upload direct depuis le navigateur
   * @param options - Options d'upload
   * @returns URL presignée et clé du fichier
   */
  getPresignedUploadUrl(
    options: PresignedUploadOptions
  ): Promise<PresignedUploadResult>

  /**
   * Génère une URL presignée pour le téléchargement
   * @param key - Clé S3 du fichier
   * @param expiresIn - Durée de validité en secondes (défaut: 3600)
   * @returns URL presignée de téléchargement
   */
  getPresignedDownloadUrl(
    key: string,
    expiresIn?: number
  ): Promise<PresignedDownloadResult>

  /**
   * Supprime un fichier de S3
   * @param key - Clé S3 du fichier
   */
  delete(key: string): Promise<void>

  /**
   * Génère l'URL publique d'un fichier
   * @param key - Clé S3 du fichier
   * @returns URL publique
   */
  getPublicUrl(key: string): string

  /**
   * Vérifie si un fichier existe
   * @param key - Clé S3 du fichier
   * @returns true si le fichier existe
   */
  exists(key: string): Promise<boolean>

  /**
   * Récupère les métadonnées d'un fichier
   * @param key - Clé S3 du fichier
   * @returns Métadonnées du fichier
   */
  getMetadata(key: string): Promise<ObjectMetadata>
}

/**
 * Crée une instance du service S3
 * @param config - Configuration S3
 * @param client - Client S3 injectable
 * @returns Instance du service S3
 */
export function createS3Service(
  config: S3Config,
  client: S3Operations
): S3Service {
  const { bucketName, publicBaseUrl } = config

  /**
   * Génère une clé S3 unique
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
   * Construit l'URL publique
   */
  function buildPublicUrl(key: string): string {
    if (publicBaseUrl) {
      return `${publicBaseUrl}/${key}`
    }
    return `https://${bucketName}.s3.${config.region}.amazonaws.com/${key}`
  }

  /**
   * Calcule la taille d'un fichier
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
      // Validation des options
      const validatedOptions = uploadOptionsSchema.parse(options)
      const { folder, filename, contentType, maxSize, metadata } =
        validatedOptions

      // Validation du type MIME
      validateMimeType(folder, contentType)

      // Validation de la taille
      const size = getFileSize(file)
      validateFileSize(folder, size, maxSize)

      // Génération de la clé
      const key = generateKey(folder, contentType, filename)

      // Upload vers S3
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
      // Validation des options
      const validatedOptions = presignedUploadOptionsSchema.parse(options)
      const { folder, filename, contentType, maxSize } = validatedOptions

      // Validation du type MIME
      validateMimeType(folder, contentType)

      // Génération de la clé
      const key = generateKey(folder, contentType, filename)

      // Durée de validité : 15 minutes
      const expiresIn = 15 * 60

      // Génération de l'URL presignée
      const uploadUrl = await client.getSignedUrl({
        key,
        expiresIn,
        operation: 'putObject',
      })

      return {
        uploadUrl,
        key,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      }
    },

    async getPresignedDownloadUrl(key, expiresIn = 3600) {
      // Validation de la clé
      s3KeySchema.parse(key)

      // Génération de l'URL presignée
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
      // Validation de la clé
      s3KeySchema.parse(key)

      await client.deleteObject({ key })
    },

    getPublicUrl(key) {
      // Validation de la clé
      s3KeySchema.parse(key)

      return buildPublicUrl(key)
    },

    async exists(key) {
      // Validation de la clé
      s3KeySchema.parse(key)

      try {
        await client.headObject({ key })
        return true
      } catch (error) {
        return false
      }
    },

    async getMetadata(key) {
      // Validation de la clé
      s3KeySchema.parse(key)

      return await client.headObject({ key })
    },
  }
}
